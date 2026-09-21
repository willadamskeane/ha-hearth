// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolvePublicHassUrl } from '../../../server-url.js';

describe('resolvePublicHassUrl', () => {
	it('uses HASS_URL for a standalone deployment', () => {
		expect(
			resolvePublicHassUrl({}, { addon: false, hassUrl: 'http://homeassistant.local:8123' })
		).toBe('http://homeassistant.local:8123');
	});

	it('uses an explicit public URL before deployment-specific discovery', () => {
		expect(
			resolvePublicHassUrl(
				{
					'x-hass-source': 'core.ingress',
					'x-forwarded-proto': 'https',
					'x-forwarded-host': 'remote.example'
				},
				{
					addon: true,
					publicHassUrl: 'https://home.example'
				}
			)
		).toBe('https://home.example');
	});

	it('derives the browser URL from trusted Supervisor Ingress headers', () => {
		expect(
			resolvePublicHassUrl(
				{
					'x-hass-source': 'core.ingress',
					'x-forwarded-proto': 'https',
					'x-forwarded-host': 'example.ui.nabu.casa'
				},
				{ addon: true, hassUrl: 'http://homeassistant:8123' }
			)
		).toBe('https://example.ui.nabu.casa');
	});

	it('does not trust forwarded headers outside Supervisor Ingress', () => {
		expect(
			resolvePublicHassUrl(
				{
					'x-forwarded-proto': 'https',
					'x-forwarded-host': 'attacker.example'
				},
				{ addon: true, hassUrl: 'http://homeassistant:8123' }
			)
		).toBeUndefined();
	});

	it('maps a directly exposed add-on port back to the Home Assistant port', () => {
		expect(
			resolvePublicHassUrl(
				{ host: '192.168.1.180:5050' },
				{ addon: true, exposedPort: '5050', hassPort: '8123' }
			)
		).toBe('http://192.168.1.180:8123');
	});

	it('does not leak the internal add-on URL when no public route can be derived', () => {
		expect(
			resolvePublicHassUrl(
				{ host: 'fdd91bd4-ha-hearth:8099' },
				{ addon: true, hassUrl: 'http://homeassistant:8123' }
			)
		).toBeUndefined();
	});
});
