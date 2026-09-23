/*
 * The page stack both kiosk tools run: this checkout's build/ served by
 * server.js with a captured dashboard, pointed at e2e/fake-hass.mjs loaded
 * with a captured house (states.json + looping replay.json). Nothing it
 * serves can reach a real Home Assistant.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function waitFor(url, seconds) {
	const deadline = Date.now() + seconds * 1000;
	while (Date.now() < deadline) {
		try {
			if ((await fetch(url)).status < 500) return;
		} catch {
			// not listening yet
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error(`${url} did not come up`);
}

/**
 * @param {{ data: string, host: string, fakePort?: number, appPort?: number,
 *   overrides?: string[], customJs?: string }} options
 */
export async function startStack({
	data,
	host,
	fakePort = 8130,
	appPort = 8131,
	overrides = [],
	customJs
}) {
	data = resolve(data);
	const work = mkdtempSync(join(tmpdir(), 'kiosk-bench-'));
	const children = [];
	const stop = () => {
		for (const child of children) child.kill();
		rmSync(work, { recursive: true, force: true });
	};
	try {
		// the dashboard, with experiment overrides; the overlay would skew timings
		const hearth = JSON.parse(readFileSync(join(data, 'hearth.json'), 'utf8'));
		delete hearth.perf_overlay;
		for (const assignment of overrides) {
			const [key, ...rest] = assignment.split('=');
			hearth[key] = JSON.parse(rest.join('='));
		}
		mkdirSync(join(work, 'data'));
		symlinkSync(join(ROOT, 'build'), join(work, 'build'));
		writeFileSync(join(work, 'data/hearth.yaml'), JSON.stringify(hearth));
		writeFileSync(
			join(work, 'data/configuration.yaml'),
			`token: kiosk-bench\ncustom_js: ${customJs ? 'true' : 'false'}\n`
		);
		if (customJs) writeFileSync(join(work, 'data/custom_javascript.js'), customJs);

		children.push(
			spawn('node', [join(ROOT, 'e2e/fake-hass.mjs')], {
				stdio: 'ignore',
				env: {
					...process.env,
					FAKE_HASS_PORT: String(fakePort),
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
					PORT: String(appPort),
					HASS_URL: `http://127.0.0.1:${fakePort}`,
					PUBLIC_HASS_URL: `http://${host}:${fakePort}`,
					NODE_ENV: 'production'
				}
			})
		);
		await waitFor(`http://127.0.0.1:${fakePort}/_test/calls`, 20);
		await waitFor(`http://127.0.0.1:${appPort}/`, 30);
		return {
			appUrl: `http://${host}:${appPort}`,
			fakeUrl: `http://127.0.0.1:${fakePort}`,
			stop
		};
	} catch (error) {
		stop();
		throw error;
	}
}
