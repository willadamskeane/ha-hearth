// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'fs/promises';
import { load } from './+page.server';

vi.mock('fs/promises', () => ({ readFile: vi.fn() }));

beforeEach(() => {
	vi.mocked(readFile).mockResolvedValue('');
	vi.stubEnv('HASS_URL', 'http://homeassistant:8123');
	vi.stubEnv('HASS_PUBLIC_URL', '');
});
afterEach(() => vi.unstubAllEnvs());

async function configuration(ingress = false) {
	const request = new Request('http://container:8099/', {
		headers: ingress
			? {
					'X-Hass-Source': 'core.ingress',
					'X-Forwarded-Proto': 'https',
					'X-Forwarded-Host': 'example.ui.nabu.casa'
				}
			: {}
	});
	return (await load({ request } as Parameters<typeof load>[0])).configuration;
}

describe('browser Home Assistant URL', () => {
	it('uses the forwarded Home Assistant origin under Ingress instead of the internal server address', async () => {
		expect((await configuration(true)).hassUrl).toBe('https://example.ui.nabu.casa');
		expect(process.env.HASS_URL).toBe('http://homeassistant:8123');
	});

	it('preserves the configured URL for direct access', async () => {
		expect((await configuration()).hassUrl).toBe('http://homeassistant:8123');
	});

	it.each([true, false])(
		'uses Ingress origin before the direct-access public URL (Ingress: %s)',
		async (ingress) => {
			vi.stubEnv('HASS_PUBLIC_URL', 'https://ha.example.com');
			expect((await configuration(ingress)).hassUrl).toBe(
				ingress ? 'https://example.ui.nabu.casa' : 'https://ha.example.com'
			);
			expect(process.env.HASS_URL).toBe('http://homeassistant:8123');
		}
	);

	it('keeps the missing configuration state for standalone access', async () => {
		vi.stubEnv('HASS_URL', '');
		expect((await configuration()).hassUrl).toBeUndefined();
	});
});

describe('configuration.yaml errors', () => {
	afterEach(() => vi.restoreAllMocks());

	async function loadWith(files: Record<string, string>) {
		vi.mocked(readFile).mockImplementation(async (file) => files[String(file)] ?? '');
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const request = new Request('http://container:8099/');
		return load({ request } as Parameters<typeof load>[0]);
	}

	it('returns the error to the page when configuration.yaml cannot be parsed', async () => {
		const data = await loadWith({ './data/configuration.yaml': 'locale: [unclosed' });
		expect(data.configurationError).toEqual(expect.any(String));
		expect(data.configuration.locale).toBeUndefined();
	});

	it('returns the error when configuration.yaml is not a mapping', async () => {
		const data = await loadWith({ './data/configuration.yaml': '- a\n- b' });
		expect(data.configurationError).toBe('configuration.yaml must contain a YAML mapping');
	});

	it('reports no error for a missing or valid configuration.yaml', async () => {
		expect((await loadWith({})).configurationError).toBeNull();
		expect(
			(await loadWith({ './data/configuration.yaml': 'locale: de' })).configurationError
		).toBeNull();
	});
});

describe('hearth.yaml errors', () => {
	afterEach(() => vi.restoreAllMocks());

	async function loadHearth(content: string) {
		vi.mocked(readFile).mockImplementation(async (file) =>
			String(file) === './data/hearth.yaml' ? content : ''
		);
		const request = new Request('http://container:8099/');
		return load({ request } as Parameters<typeof load>[0]);
	}

	it.each([
		['unparseable YAML', 'rooms: [unclosed', 'unreadable'],
		['a list instead of a mapping', '- a\n- b', 'unreadable'],
		['an unsupported version', 'version: 999\nrooms: []', 'version']
	])('names %s as %s', async (_label, content, kind) => {
		const data = await loadHearth(content);
		expect(data.hearthError).toEqual(expect.any(String));
		expect(data.hearthErrorKind).toBe(kind);
	});

	it('reports no kind for a missing file', async () => {
		const data = await loadHearth('');
		expect(data.hearthError).toBeNull();
		expect(data.hearthErrorKind).toBeNull();
	});
});

describe('Home Assistant URL configuration', () => {
	it('uses the private server hand-off header', async () => {
		vi.stubEnv('ADDON', 'true');
		vi.stubEnv('HASS_URL', 'http://homeassistant:8123');
		const request = new Request('http://hearth.local', {
			headers: { 'x-hearth-hass-url': 'https://example.ui.nabu.casa' }
		});

		const result = await load({ request } as Parameters<typeof load>[0]);

		expect(result.configuration.hassUrl).toBe('https://example.ui.nabu.casa');
	});

	it('does not expose the Supervisor hostname in add-on mode', async () => {
		vi.stubEnv('ADDON', 'true');
		vi.stubEnv('HASS_URL', 'http://homeassistant:8123');

		const result = await load({ request: new Request('http://hearth.local') } as Parameters<
			typeof load
		>[0]);

		expect(result.configuration.hassUrl).toBeUndefined();
	});

	it('uses HASS_URL for standalone and development deployments', async () => {
		vi.stubEnv('ADDON', 'false');
		vi.stubEnv('HASS_URL', 'http://homeassistant.local:8123');

		const result = await load({ request: new Request('http://hearth.local') } as Parameters<
			typeof load
		>[0]);

		expect(result.configuration.hassUrl).toBe('http://homeassistant.local:8123');
	});

	it('marks trusted rewritten Ingress requests for same-origin authentication', async () => {
		vi.stubEnv('ADDON', 'true');

		const result = await load({
			request: new Request('http://127.0.0.1:2325/624a9b35_ha_hearth', {
				headers: {
					'x-hearth-hass-url': 'https://homeassistant.local:8123',
					'x-hearth-ingress': '1'
				}
			})
		} as Parameters<typeof load>[0]);

		expect(result.configuration.ingress).toBe(true);
		expect(result.configuration.hassUrl).toBe('https://homeassistant.local:8123');
	});
});
