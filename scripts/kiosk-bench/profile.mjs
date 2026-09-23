#!/usr/bin/env node
/*
 * Profiles opening each page, locally, in headless Chromium emulating the
 * wall tablet (viewport, pixel ratio, Android user agent so low-power mode
 * engages) with the CPU throttled to roughly its speed. Uses the same stack
 * as run.mjs, so every service call lands on the fake Home Assistant.
 *
 *   HEARTH_SOURCEMAP=true npm run build
 *   node scripts/kiosk-bench/profile.mjs --data <dir> [--throttle 6] [--rooms a,b] [--repeat 3]
 *
 * For each page switch it reports script / style / layout time (from the
 * Performance domain) and the functions with the most self time, mapped
 * through the build's source maps when present.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { ROOT, startStack } from './stack.mjs';

// trace-mapping arrives transitively (vite, svelte); load it from the pnpm store
// rather than adding a dependency for a dev-only script
const store = join(ROOT, 'node_modules/.pnpm');
const traceDir = readdirSync(store).find((name) => name.startsWith('@jridgewell+trace-mapping@'));
const { TraceMap, originalPositionFor } = await import(
	pathToFileURL(
		join(store, traceDir, 'node_modules/@jridgewell/trace-mapping/dist/trace-mapping.mjs')
	).href
);

const args = { throttle: 6, repeat: 3, top: 15 };
for (let i = 2; i < process.argv.length; i += 2)
	args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.data) throw new Error('--data is required');

const maps = new Map();
function original(url, line, column) {
	const file = url.split('/_app/')[1];
	if (!file) return null;
	if (!maps.has(file)) {
		const path = join(ROOT, 'build/client/_app', `${file}.map`);
		maps.set(file, existsSync(path) ? new TraceMap(JSON.parse(readFileSync(path, 'utf8'))) : null);
	}
	const map = maps.get(file);
	if (!map) return null;
	const position = originalPositionFor(map, { line: line + 1, column });
	if (!position.source) return null;
	const source = position.source.replace(
		/^.*?(src\/|node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?)/,
		''
	);
	return `${source}:${position.line}${position.name ? ` ${position.name}` : ''}`;
}

// charge each sample to the nearest Hearth frame (component, action, store) on
// its stack, so DOM building and Svelte runtime time lands on the code asking for it
function hearthTimes(profile) {
	const byId = new Map(profile.nodes.map((node) => [node.id, node]));
	const parent = new Map();
	for (const node of profile.nodes)
		for (const child of node.children ?? []) parent.set(child, node.id);
	const owner = new Map();
	const ownerOf = (id) => {
		if (owner.has(id)) return owner.get(id);
		const frame = byId.get(id).callFrame;
		const mapped = frame.url ? original(frame.url, frame.lineNumber, frame.columnNumber) : null;
		const result =
			mapped && /^lib\//.test(mapped)
				? args['by-line']
					? mapped
					: mapped.replace(/:\d+.*$/, '')
				: parent.has(id)
					? ownerOf(parent.get(id))
					: null;
		owner.set(id, result);
		return result;
	};
	const totals = new Map();
	for (let i = 0; i < profile.samples.length; i++) {
		const node = byId.get(profile.samples[i]);
		if (/^\((idle|program|garbage collector|root)\)$/.test(node.callFrame.functionName)) continue;
		const key = ownerOf(node.id) ?? '(outside Hearth code)';
		totals.set(key, (totals.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
	}
	return totals;
}

function selfTimes(profile) {
	const byId = new Map(profile.nodes.map((node) => [node.id, node]));
	const self = new Map();
	for (let i = 0; i < profile.samples.length; i++) {
		const node = byId.get(profile.samples[i]);
		const frame = node.callFrame;
		const key =
			(frame.url && original(frame.url, frame.lineNumber, frame.columnNumber)) ||
			`${frame.functionName || '(anonymous)'} ${frame.url.split('/').pop()}:${frame.lineNumber + 1}`;
		self.set(key, (self.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
	}
	return self;
}

const stack = await startStack({ data: args.data, host: '127.0.0.1' });
const browser = await chromium.launch();
try {
	const context = await browser.newContext({
		viewport: { width: 788, height: 492 },
		deviceScaleFactor: 1.625,
		isMobile: true,
		hasTouch: true,
		userAgent:
			'Mozilla/5.0 (Linux; Android 8.1.0; Lenovo StarView) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36'
	});
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	await page.goto(`${stack.appUrl}/?room=home&menu=false`);
	await page.waitForSelector('main .tile', { timeout: 60000 });
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(args.throttle) });
	await cdp.send('Performance.enable');
	await cdp.send('Profiler.enable');
	await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
	await page.waitForTimeout(3000);

	const metrics = async () =>
		Object.fromEntries(
			(await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value])
		);
	const tabs = await page.$$eval('.phone-nav .page', (nodes) =>
		nodes.map((n) => n.textContent.trim())
	);
	const wanted = args.rooms ? args.rooms.split(',') : null;
	const total = new Map();
	const byComponent = new Map();
	const rows = [];

	for (let repeat = 0; repeat < Number(args.repeat); repeat++) {
		for (let index = 1; index <= tabs.length; index++) {
			const target = index % tabs.length; // ends back on Home
			if (wanted && !wanted.some((w) => tabs[target].toLowerCase().includes(w.toLowerCase())))
				continue;
			const before = await metrics();
			await cdp.send('Profiler.start');
			const [switchMs, settledMs] = await page.evaluate(async (i) => {
				const tab = document.querySelectorAll('.phone-nav .page')[i];
				const start = performance.now();
				tab.click();
				// first paint: a task queued from the next frame runs after it paints
				await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
				const first = performance.now() - start;
				await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
				return [first, performance.now() - start];
			}, target);
			const { profile } = await cdp.send('Profiler.stop');
			const after = await metrics();
			for (const [key, ms] of selfTimes(profile)) total.set(key, (total.get(key) ?? 0) + ms);
			for (const [key, ms] of hearthTimes(profile))
				byComponent.set(key, (byComponent.get(key) ?? 0) + ms);
			rows.push({
				page: tabs[target],
				switch: Math.round(switchMs),
				settled: Math.round(settledMs),
				script: Math.round((after.ScriptDuration - before.ScriptDuration) * 1000),
				style: Math.round((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000),
				layout: Math.round((after.LayoutDuration - before.LayoutDuration) * 1000),
				nodes: after.Nodes
			});
			await page.waitForTimeout(600);
		}
	}

	// average the repeats per page
	const perPage = new Map();
	for (const row of rows) {
		const entry = perPage.get(row.page) ?? {
			page: row.page,
			n: 0,
			switch: 0,
			settled: 0,
			script: 0,
			style: 0,
			layout: 0,
			nodes: 0
		};
		entry.n++;
		for (const key of ['switch', 'settled', 'script', 'style', 'layout']) entry[key] += row[key];
		entry.nodes = row.nodes;
		perPage.set(row.page, entry);
	}
	console.log(`\nper page switch at ${args.throttle}x CPU throttle (ms, mean of ${args.repeat})`);
	console.table(
		[...perPage.values()].map((e) => ({
			page: e.page,
			firstPaint: Math.round(e.switch / e.n),
			settled: Math.round(e.settled / e.n),
			script: Math.round(e.script / e.n),
			style: Math.round(e.style / e.n),
			layout: Math.round(e.layout / e.n),
			domNodes: e.nodes
		}))
	);
	const sum = (key) => rows.reduce((s, r) => s + r[key], 0);
	console.log(
		`totals: switch ${sum('switch')}ms · script ${sum('script')} · style ${sum('style')} · layout ${sum('layout')}`
	);
	console.log(`\ntime by the Hearth code that caused it, across all switches (ms)`);
	console.table(
		[...byComponent.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, Number(args.top))
			.map(([code, ms]) => ({ code, ms: Math.round(ms) }))
	);
	console.log(`\ntop self time across all switches (ms)`);
	console.table(
		[...total.entries()]
			.filter(([key]) => !/^\((idle|program|garbage collector|root)\)/.test(key))
			.sort((a, b) => b[1] - a[1])
			.slice(0, Number(args.top))
			.map(([fn, ms]) => ({ fn, ms: Math.round(ms) }))
	);
} finally {
	await browser.close();
	stack.stop();
}
