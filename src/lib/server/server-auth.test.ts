// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	isTrustedDirectRequest,
	normalizeClientAddress,
	parseTrustedClients,
	supervisorWebsocketTarget,
	supervisorAuthMessage
} from '../../../server-auth.js';

describe('direct server authentication', () => {
	it('normalizes IPv4-mapped socket addresses', () => {
		expect(normalizeClientAddress('::ffff:192.168.1.227')).toBe('192.168.1.227');
		expect(normalizeClientAddress('fe80::1%en0')).toBe('fe80::1');
	});

	it('trusts only the real socket address when direct access is enabled', () => {
		const trusted = parseTrustedClients('["192.168.1.227"]');
		const request = {
			socket: { remoteAddress: '::ffff:192.168.1.227' },
			headers: { 'x-forwarded-for': '192.168.1.99' }
		};
		expect(isTrustedDirectRequest(request, true, trusted)).toBe(true);
		expect(isTrustedDirectRequest(request, false, trusted)).toBe(false);
		expect(
			isTrustedDirectRequest(
				{
					socket: { remoteAddress: '192.168.1.99' },
					headers: { 'x-forwarded-for': '192.168.1.227' }
				},
				true,
				trusted
			)
		).toBe(false);
	});

	it('builds the Home Assistant WebSocket target', () => {
		expect(supervisorWebsocketTarget('http://supervisor')).toBe('ws://supervisor/core/websocket');
	});

	it('replaces only auth messages without mutating the input', () => {
		const input = JSON.stringify({ type: 'auth', access_token: 'browser-placeholder' });
		expect(supervisorAuthMessage(input, 'server-secret')).toBe(
			JSON.stringify({ type: 'auth', access_token: 'server-secret' })
		);
		expect(supervisorAuthMessage(JSON.stringify({ id: 1, type: 'get_states' }), 'secret')).toBe(
			undefined
		);
		expect(input).toContain('browser-placeholder');
	});
});
