<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { states } from '$lib/core/ha/entities';

	/**
	 * Diagnostic overlay (perf_overlay: true or ?perf=1): rolling 60 s of frame
	 * pacing, long tasks split by which frame caused them, the scripts behind
	 * long animation frames, and per-tap timings, so lag on a wall tablet can be
	 * measured on the real page stack instead of guessed at. Its own rAF loop
	 * keeps the page painting while it runs.
	 */
	const WINDOW = 60_000;
	const SCROLL_GRACE = 150;

	interface Stamped {
		t: number;
	}
	interface FrameGap extends Stamped {
		gap: number;
		scrolling: boolean;
	}
	interface Task extends Stamped {
		duration: number;
		origin: string;
	}
	interface Script extends Stamped {
		source: string;
		duration: number;
	}
	interface Tap extends Stamped {
		duration: number;
		delay: number;
		run: number;
		paint: number;
	}

	let frames: FrameGap[] = [];
	let tasks: Task[] = [];
	let scripts: Script[] = [];
	let taps: Tap[] = [];
	let updates: Stamped[] = [];
	let scrollingUntil = 0;
	let text = $state('measuring…');

	function trim<T extends Stamped>(list: T[], now: number): T[] {
		const cutoff = now - WINDOW;
		let index = 0;
		while (index < list.length && list[index].t < cutoff) index++;
		return index ? list.slice(index) : list;
	}

	function quantile(values: number[], q: number): number {
		if (!values.length) return 0;
		const sorted = [...values].sort((a, b) => a - b);
		return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
	}

	// "https://host/path/file.js?x" -> "file.js"; inline and extension code keep a label
	function scriptLabel(url: string): string {
		if (!url) return 'inline';
		try {
			const path = new URL(url).pathname;
			return path.split('/').filter(Boolean).pop() ?? path;
		} catch {
			return url.slice(-40);
		}
	}

	const ms = (value: number) => `${Math.round(value)}ms`;

	function sumBy<T>(list: T[], key: (item: T) => string, value: (item: T) => number) {
		const totals: Record<string, number> = {};
		for (const item of list) totals[key(item)] = (totals[key(item)] ?? 0) + value(item);
		return Object.entries(totals).sort((a, b) => b[1] - a[1]);
	}

	function render(now: number) {
		frames = trim(frames, now);
		tasks = trim(tasks, now);
		scripts = trim(scripts, now);
		taps = trim(taps, now);
		updates = trim(updates, now);

		const fps = frames.filter((frame) => frame.t > now - 1000).length;
		const slow = frames.filter((frame) => frame.gap > 50).length;
		const worst = ms(Math.max(0, ...frames.map((frame) => frame.gap)));
		const scroll = frames.filter((frame) => frame.scrolling);
		const scrollSeconds = scroll.reduce((sum, frame) => sum + frame.gap, 0) / 1000;
		const scrollFps = (scroll.length / Math.max(scrollSeconds, 0.001)).toFixed(0);
		const scrollP95 = ms(
			quantile(
				scroll.map((frame) => frame.gap),
				0.95
			)
		);
		const scrollWorst = ms(Math.max(0, ...scroll.map((frame) => frame.gap)));
		const taskTotal = ms(tasks.reduce((sum, task) => sum + task.duration, 0));
		const taskMax = ms(Math.max(0, ...tasks.map((task) => task.duration)));
		const origins = sumBy(
			tasks,
			(task) => task.origin,
			(task) => task.duration
		)
			.map(([origin, total]) => `${origin} ${ms(total)}`)
			.join(' · ');
		const sources = sumBy(
			scripts,
			(script) => script.source,
			(script) => script.duration
		)
			.slice(0, 4)
			.map(([source, total]) => `${source} ${ms(total)}`)
			.join(' · ');
		const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
		const heapMb = heap ? Math.round(heap.usedJSHeapSize / 1048576) : 0;
		const tapP75 = ms(
			quantile(
				taps.map((tap) => tap.duration),
				0.75
			)
		);
		const w = taps.reduce<Tap | null>((a, b) => (!a || b.duration > a.duration ? b : a), null);
		const rate = (updates.length / 60).toFixed(1);

		const lines = [
			`fps ${fps} · >50ms frames ${slow}/60s · worst ${worst}`, // copy ok: diagnostics
			scroll.length
				? `scroll ${scrollFps} fps · p95 ${scrollP95} · worst ${scrollWorst}` // copy ok: diagnostics
				: 'scroll: none yet', // copy ok: diagnostics
			`long tasks ${tasks.length}/60s · ${taskTotal} · max ${taskMax}`, // copy ok: diagnostics
			`  by frame: ${origins || '-'}`, // copy ok: diagnostics
			`  scripts: ${sources || '-'}`, // copy ok: diagnostics
			w
				? `taps ${taps.length} · p75 ${tapP75} · max ${ms(w.duration)}` + // copy ok: diagnostics
					` (delay ${ms(w.delay)} · run ${ms(w.run)} · paint ${ms(w.paint)})` // copy ok: diagnostics
				: 'taps: none yet', // copy ok: diagnostics
			`entity updates ${rate}/s · heap ${heapMb}MB` // copy ok: diagnostics
		];
		text = lines.join('\n');
	}

	let raf = 0;
	let timer: ReturnType<typeof setInterval> | undefined;
	const observers: PerformanceObserver[] = [];
	let unsubscribe = () => {};

	function observe(type: string, callback: (entries: PerformanceEntryList) => void, extra = {}) {
		if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
		const observer = new PerformanceObserver((list) => callback(list.getEntries()));
		observer.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
		observers.push(observer);
	}

	const markScroll = () => (scrollingUntil = performance.now() + SCROLL_GRACE);

	onMount(() => {
		let last = 0;
		const tick = (now: number) => {
			if (last) frames.push({ t: now, gap: now - last, scrolling: now < scrollingUntil });
			last = now;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		addEventListener('scroll', markScroll, { capture: true, passive: true });

		observe('longtask', (entries) => {
			for (const entry of entries) {
				const attribution = (entry as PerformanceEntry & { attribution?: { name: string }[] })
					.attribution;
				tasks.push({
					t: entry.startTime + entry.duration,
					duration: entry.duration,
					// "self" is Hearth; "same-origin-ancestor" is the Home Assistant page hosting it
					origin:
						attribution?.[0]?.name === 'same-origin-ancestor'
							? 'host'
							: (attribution?.[0]?.name ?? 'unknown')
				});
			}
		});
		observe('long-animation-frame', (entries) => {
			for (const entry of entries) {
				const frame = entry as PerformanceEntry & {
					scripts?: { sourceURL: string; duration: number }[];
				};
				for (const script of frame.scripts ?? [])
					scripts.push({
						t: entry.startTime + entry.duration,
						source: scriptLabel(script.sourceURL),
						duration: script.duration
					});
			}
		});
		observe(
			'event',
			(entries) => {
				for (const entry of entries) {
					const event = entry as PerformanceEventTiming & { interactionId?: number };
					if (!event.interactionId) continue;
					taps.push({
						t: event.startTime + event.duration,
						duration: event.duration,
						delay: event.processingStart - event.startTime,
						run: event.processingEnd - event.processingStart,
						paint: Math.max(0, event.startTime + event.duration - event.processingEnd)
					});
				}
			},
			{ durationThreshold: 16 }
		);

		unsubscribe = states.subscribe(() => updates.push({ t: performance.now() }));
		timer = setInterval(() => render(performance.now()), 1000);
	});

	onDestroy(() => {
		cancelAnimationFrame(raf);
		clearInterval(timer);
		removeEventListener('scroll', markScroll, { capture: true });
		for (const observer of observers) observer.disconnect();
		unsubscribe();
	});
</script>

<pre class="perf-hud" aria-hidden="true">{text}</pre>

<style>
	.perf-hud {
		position: fixed;
		right: 8px;
		bottom: 8px;
		z-index: calc(var(--h-layer-screensaver) + 1);
		max-width: calc(100vw - 16px);
		margin: 0;
		padding: 8px 10px;
		border-radius: var(--h-radius-sm);
		background: var(--h-bg-1);
		color: var(--h-good-text);
		opacity: 0.9;
		font:
			12px / 1.35 ui-monospace,
			monospace;
		white-space: pre-wrap;
		pointer-events: none;
	}
</style>
