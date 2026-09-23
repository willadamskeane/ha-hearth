/*
 * Kiosk benchmark driver. run.mjs installs this as the dashboard's custom
 * JavaScript, prefixed with `window.__KIOSK_BENCH__ = { results, ... }`, on a
 * Hearth instance whose Home Assistant is the fake server: every tap below
 * reaches that fake, never a real device.
 *
 * Scenarios, each measured with rAF frame gaps, long tasks and long
 * animation frames: idle, switching every page tab, tapping tiles on the
 * first page (each twice, so the fake state ends where it started), and
 * scrolling the first page down and back up. Results are POSTed as JSON.
 */
(async function kioskBench() {
	const config = window.__KIOSK_BENCH__ ?? {};
	const post = (body) =>
		fetch(config.results, { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
	// the frame after next has started, so the one carrying the change was produced
	const painted = async () => {
		await frame();
		await frame();
		return performance.now();
	};

	try {
		for (let i = 0; i < 240 && !document.querySelector('main .tile'); i++) await sleep(250);
		if (!document.querySelector('main .tile')) throw new Error('dashboard never rendered a tile');
		await sleep(config.settleMs ?? 5000);

		const longTasks = [];
		const longFrames = [];
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries())
				longTasks.push({ t: entry.startTime, d: entry.duration });
		}).observe({ type: 'longtask' });
		if (PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')) {
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries())
					longFrames.push({
						t: entry.startTime,
						d: entry.duration,
						render: entry.duration - ((entry.renderStart || entry.startTime) - entry.startTime),
						scripts: (entry.scripts ?? []).map((script) => ({
							source: (script.sourceURL || 'inline').split('/').pop(),
							fn: script.sourceFunctionName || script.invoker || '',
							d: script.duration
						}))
					});
			}).observe({ type: 'long-animation-frame' });
		}

		const quantile = (values, q) => {
			if (!values.length) return 0;
			const sorted = [...values].sort((a, b) => a - b);
			return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))]);
		};
		const within = (list, start, end) => list.filter((item) => item.t >= start && item.t <= end);

		function recordFrames() {
			const gaps = [];
			let last = null;
			let running = true;
			const tick = (time) => {
				if (last !== null) gaps.push(time - last);
				last = time;
				if (running) requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
			return () => {
				running = false;
				return gaps;
			};
		}

		function frameStats(gaps) {
			const total = gaps.reduce((sum, gap) => sum + gap, 0);
			return {
				fps: total ? Math.round((gaps.length / total) * 10000) / 10 : 0,
				p50: quantile(gaps, 0.5),
				p95: quantile(gaps, 0.95),
				max: Math.round(Math.max(0, ...gaps)),
				over50: gaps.filter((gap) => gap > 50).length
			};
		}

		function frameCosts(frames) {
			const bySource = {};
			for (const frame of frames)
				for (const script of frame.scripts) {
					const key = `${script.source} ${script.fn}`.trim();
					bySource[key] = (bySource[key] ?? 0) + script.d;
				}
			return {
				count: frames.length,
				totalMs: Math.round(frames.reduce((sum, frame) => sum + frame.d, 0)),
				renderMs: Math.round(frames.reduce((sum, frame) => sum + Math.max(0, frame.render), 0)),
				topScripts: Object.entries(bySource)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 6)
					.map(([source, ms]) => [source, Math.round(ms)])
			};
		}

		const results = {
			userAgent: navigator.userAgent,
			viewport: [innerWidth, innerHeight, devicePixelRatio],
			lowPower: document.documentElement.classList.contains('low-power'),
			scenarios: {}
		};

		async function scenario(name, run) {
			const start = performance.now();
			const stop = recordFrames();
			const detail = (await run()) ?? {};
			const gaps = stop();
			const end = performance.now();
			const tasks = within(longTasks, start, end);
			results.scenarios[name] = {
				seconds: Math.round((end - start) / 100) / 10,
				frames: frameStats(gaps),
				longTasks: {
					count: tasks.length,
					totalMs: Math.round(tasks.reduce((sum, task) => sum + task.d, 0)),
					maxMs: Math.round(Math.max(0, ...tasks.map((task) => task.d)))
				},
				longFrames: frameCosts(within(longFrames, start, end)),
				...detail
			};
			post({ type: 'progress', scenario: name });
		}

		const tabs = () => [...document.querySelectorAll('.phone-nav .page')];
		const firstTab = tabs()[0];

		await scenario('idle', () => sleep(config.idleMs ?? 10000));

		await scenario('tabs', async () => {
			const switchMs = [];
			const list = tabs().slice(0, config.tabs ?? 14);
			for (const tab of [...list.slice(1), list[0]]) {
				const start = performance.now();
				tab.click();
				switchMs.push(Math.round((await painted()) - start));
				await sleep(1200);
			}
			return { switchMs, switchP50: quantile(switchMs, 0.5), switchMax: Math.max(...switchMs) };
		});

		firstTab?.click();
		await sleep(1500);

		await scenario('taps', async () => {
			const tapToFrameMs = [];
			const tapToChangeMs = [];
			const tiles = [...document.querySelectorAll('main .tile')]
				.filter((tile) => tile.offsetParent && tile.getBoundingClientRect().bottom < innerHeight)
				.slice(0, config.taps ?? 6);
			for (const tile of tiles) {
				for (let repeat = 0; repeat < 2; repeat++) {
					const box = tile.getBoundingClientRect();
					const init = {
						bubbles: true,
						cancelable: true,
						pointerId: 71,
						isPrimary: true,
						pointerType: 'touch',
						clientX: box.left + box.width / 2,
						clientY: box.top + box.height / 2
					};
					let changedAt = null;
					const observer = new MutationObserver(() => (changedAt ??= performance.now()));
					observer.observe(tile, {
						subtree: true,
						childList: true,
						characterData: true,
						attributes: true
					});
					const start = performance.now();
					tile.dispatchEvent(new PointerEvent('pointerdown', init));
					tile.dispatchEvent(new PointerEvent('pointerup', init));
					tile.dispatchEvent(new MouseEvent('click', init));
					tapToFrameMs.push(Math.round((await painted()) - start));
					await sleep(900);
					observer.disconnect();
					if (changedAt !== null) tapToChangeMs.push(Math.round(changedAt - start));
					await sleep(300);
				}
			}
			return {
				tiles: tiles.length,
				tapToFrameMs,
				tapP50: quantile(tapToFrameMs, 0.5),
				tapMax: Math.max(0, ...tapToFrameMs),
				tapToChangeP50: quantile(tapToChangeMs, 0.5)
			};
		});

		await scenario('scroll', async () => {
			const scroller = [document.querySelector('.layout'), document.scrollingElement].find(
				(element) => element && element.scrollHeight - element.clientHeight > 50
			);
			if (!scroller) return { scrollable: false };
			const max = scroller.scrollHeight - scroller.clientHeight;
			const step = config.scrollStep ?? 14;
			for (const direction of [1, -1]) {
				for (let moved = 0; moved < max; moved += step) {
					scroller.scrollTop += direction * step;
					await frame();
				}
			}
			return { scrollable: true, distance: max * 2 };
		});

		post({ type: 'done', results });
	} catch (error) {
		post({ type: 'error', message: String(error?.stack ?? error) });
	}
})();
