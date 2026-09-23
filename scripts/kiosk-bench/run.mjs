#!/usr/bin/env node
/*
 * Benchmarks the built dashboard on a real device against a fake Home
 * Assistant, so nothing it taps reaches a real entity.
 *
 *   node scripts/kiosk-bench/run.mjs --data <dir> --host <lan-ip> \
 *     --open '<shell command; {url} is replaced>' --close '<shell command>' \
 *     [--set key=value ...] [--label name] [--out results.json]
 *
 * <dir> holds states.json (a get_states list), replay.json (changes as
 * { t, entity_id, state, attributes }) and hearth.json (the dashboard). The
 * runner serves this checkout's build/ with that dashboard and the driver as
 * its custom JavaScript, points it at e2e/fake-hass.mjs loaded with the
 * snapshot and replay, runs --open with the page URL, waits for the driver's
 * results, then runs --close. `--set` overrides dashboard root keys for
 * experiments (JSON values, e.g. --set scroll_edge_blur=false).
 */
import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function parseArgs(argv) {
	const args = { set: [], fakePort: 8130, appPort: 8131, resultsPort: 8132, timeout: 300 };
	for (let i = 0; i < argv.length; i++) {
		const key = argv[i].replace(/^--/, '');
		const value = argv[++i];
		if (key === 'set') args.set.push(value);
		else args[key.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = value;
	}
	for (const required of ['data', 'host', 'open', 'close'])
		if (!args[required]) throw new Error(`--${required} is required`);
	return args;
}

function waitFor(url, seconds) {
	const deadline = Date.now() + seconds * 1000;
	return (async () => {
		while (Date.now() < deadline) {
			try {
				if ((await fetch(url)).status < 500) return;
			} catch {
				// not listening yet
			}
			await new Promise((r) => setTimeout(r, 250));
		}
		throw new Error(`${url} did not come up`);
	})();
}

const args = parseArgs(process.argv.slice(2));
const data = resolve(args.data);
const children = [];
const work = mkdtempSync(join(tmpdir(), 'kiosk-bench-'));

function cleanup() {
	for (const child of children) child.kill();
	rmSync(work, { recursive: true, force: true });
}

try {
	// the dashboard, with experiment overrides; the overlay would skew timings
	const hearth = JSON.parse(readFileSync(join(data, 'hearth.json'), 'utf8'));
	delete hearth.perf_overlay;
	for (const assignment of args.set) {
		const [key, ...rest] = assignment.split('=');
		hearth[key] = JSON.parse(rest.join('='));
	}
	mkdirSync(join(work, 'data'));
	symlinkSync(join(ROOT, 'build'), join(work, 'build'));
	writeFileSync(join(work, 'data/hearth.yaml'), JSON.stringify(hearth));
	writeFileSync(join(work, 'data/configuration.yaml'), 'token: kiosk-bench\ncustom_js: true\n');
	const resultsUrl = `http://${args.host}:${args.resultsPort}/results`;
	writeFileSync(
		join(work, 'data/custom_javascript.js'),
		`window.__KIOSK_BENCH__ = ${JSON.stringify({ results: resultsUrl })};\n` +
			readFileSync(join(ROOT, 'scripts/kiosk-bench/driver.js'), 'utf8')
	);

	children.push(
		spawn('node', [join(ROOT, 'e2e/fake-hass.mjs')], {
			stdio: 'ignore',
			env: {
				...process.env,
				FAKE_HASS_PORT: String(args.fakePort),
				FAKE_HASS_HOST: '0.0.0.0',
				FAKE_HASS_STATES: join(data, 'states.json'),
				FAKE_HASS_REPLAY: join(data, 'replay.json')
			}
		}),
		spawn('node', [join(ROOT, 'server.js')], {
			cwd: work,
			stdio: 'ignore',
			env: {
				...process.env,
				PORT: String(args.appPort),
				HASS_URL: `http://127.0.0.1:${args.fakePort}`,
				PUBLIC_HASS_URL: `http://${args.host}:${args.fakePort}`,
				NODE_ENV: 'production'
			}
		})
	);

	const outcome = new Promise((resolveOutcome, reject) => {
		const server = createServer((request, response) => {
			response.setHeader('Access-Control-Allow-Origin', '*');
			let body = '';
			request.on('data', (chunk) => (body += chunk));
			request.on('end', () => {
				response.end('ok');
				if (request.method !== 'POST') return;
				const message = JSON.parse(body || '{}');
				if (message.type === 'progress') console.error(`  finished ${message.scenario}`);
				if (message.type === 'done') resolveOutcome(message.results);
				if (message.type === 'error') reject(new Error(`driver: ${message.message}`));
			});
		});
		server.listen(args.resultsPort, '0.0.0.0');
		children.push({ kill: () => server.close() });
		setTimeout(() => reject(new Error('timed out waiting for results')), args.timeout * 1000);
	});

	await waitFor(`http://127.0.0.1:${args.fakePort}/_test/calls`, 20);
	await waitFor(`http://127.0.0.1:${args.appPort}/`, 30);
	const url = `http://${args.host}:${args.appPort}/?room=${args.room ?? 'home'}&menu=false`;
	console.error(`opening ${url} on the device`);
	execSync(args.open.replaceAll('{url}', url), { stdio: 'inherit' });
	let results;
	try {
		results = await outcome;
	} finally {
		execSync(args.close, { stdio: 'inherit' });
	}
	const calls = await (await fetch(`http://127.0.0.1:${args.fakePort}/_test/calls`)).json();
	results.label = args.label ?? 'baseline';
	results.overrides = args.set;
	results.fakeServiceCalls = calls.length;
	if (args.out) writeFileSync(args.out, JSON.stringify(results, null, 2));

	const rows = Object.entries(results.scenarios).map(([name, s]) => ({
		scenario: name,
		fps: s.frames.fps,
		p95: s.frames.p95,
		max: s.frames.max,
		'>50ms': s.frames.over50,
		longTasks: `${s.longTasks.count} / ${s.longTasks.totalMs}ms`,
		detail:
			name === 'tabs'
				? `switch p50 ${s.switchP50} max ${s.switchMax}`
				: name === 'taps'
					? `tap→frame p50 ${s.tapP50} max ${s.tapMax}`
					: ''
	}));
	console.log(
		`\n${results.label} (${results.overrides.join(', ') || 'no overrides'}), lowPower=${results.lowPower}`
	);
	console.table(rows);
	console.log(`service calls answered by the fake Home Assistant: ${results.fakeServiceCalls}`);
} finally {
	cleanup();
}
