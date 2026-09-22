// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

vi.mock('fs/promises', () => ({
	readFile: vi.fn(async (file: string) => (file.endsWith('.json') ? '{}' : ''))
}));

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('Home Assistant URL configuration', () => {
	it('uses the private server hand-off header', async () => {
		vi.stubEnv('ADDON', 'true');
		vi.stubEnv('HASS_URL', 'http://homeassistant:8123');
		const request = new Request('http://hearth.local', {
			headers: { 'x-hearth-hass-url': 'https://example.ui.nabu.casa' }
		});

		const result = await load({ request });

		expect(result.configuration.hassUrl).toBe('https://example.ui.nabu.casa');
	});

	it('does not expose the Supervisor hostname in add-on mode', async () => {
		vi.stubEnv('ADDON', 'true');
		vi.stubEnv('HASS_URL', 'http://homeassistant:8123');

		const result = await load({ request: new Request('http://hearth.local') });

		expect(result.configuration.hassUrl).toBeUndefined();
	});

	it('uses HASS_URL for standalone and development deployments', async () => {
		vi.stubEnv('ADDON', 'false');
		vi.stubEnv('HASS_URL', 'http://homeassistant.local:8123');

		const result = await load({ request: new Request('http://hearth.local') });

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
		});

		expect(result.configuration.ingress).toBe(true);
		expect(result.configuration.hassUrl).toBe('https://homeassistant.local:8123');
	});
});
