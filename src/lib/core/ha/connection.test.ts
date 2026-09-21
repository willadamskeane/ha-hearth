import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createConnection,
	createLongLivedTokenAuth,
	ERR_INVALID_AUTH,
	getAuth,
	type Auth,
	type Connection
} from 'home-assistant-js-websocket';
import {
	authentication,
	connected,
	connection,
	health,
	startConnection,
	stopConnection
} from './connection';

vi.mock('home-assistant-js-websocket', async (importOriginal) => ({
	...(await importOriginal<typeof import('home-assistant-js-websocket')>()),
	createConnection: vi.fn(),
	createLongLivedTokenAuth: vi.fn(),
	getAuth: vi.fn(),
	subscribeEntities: vi.fn(),
	subscribeConfig: vi.fn(),
	subscribeServices: vi.fn()
}));

afterEach(() => {
	stopConnection();
	vi.useRealTimers();
	vi.clearAllMocks();
	localStorage.clear();
	window.history.replaceState(null, '', '/');
});

describe('authentication', () => {
	it('uses the direct server bridge without persisting a Home Assistant token', async () => {
		const auth = { expired: false } as Auth;
		const socket = {
			close: vi.fn(),
			addEventListener: vi.fn(),
			subscribeMessage: vi.fn(async () => async () => {})
		} as unknown as Connection;
		vi.mocked(createLongLivedTokenAuth).mockReturnValue(auth);
		vi.mocked(createConnection).mockResolvedValue(socket);

		await authentication({ hassUrl: '__server_proxy__', serverAuth: true });

		expect(createLongLivedTokenAuth).toHaveBeenCalledWith(
			window.location.origin,
			'hearth-server-proxy'
		);
		expect(getAuth).not.toHaveBeenCalled();
		expect(localStorage.getItem('hearthTokens')).toBeNull();
	});

	it('keeps the caller retrying when the Home Assistant URL is missing', async () => {
		health.set('connected');
		await expect(authentication({})).rejects.toThrow('Home Assistant URL is not configured');
		expect(get(health)).toBe('lost');
		expect(get(connected)).toBe(false);
	});

	it('keeps a successful socket alive until its owner stops it', async () => {
		vi.useFakeTimers();
		const close = vi.fn();
		const socket = {
			close,
			addEventListener: vi.fn(),
			subscribeMessage: vi.fn(async () => async () => {})
		} as unknown as Connection;
		vi.mocked(createConnection).mockResolvedValue(socket);
		startConnection({ hassUrl: 'http://localhost:8123', token: 'test' });
		await vi.advanceTimersByTimeAsync(10_000);
		expect(createConnection).toHaveBeenCalledOnce();
		expect(get(connection)).toBe(socket);
		expect(close).not.toHaveBeenCalled();
		stopConnection();
		expect(close).toHaveBeenCalledOnce();
		expect(get(connection)).toBeUndefined();
		expect(get(connected)).toBe(false);
	});

	it('returns standalone OAuth to the current Hearth path', async () => {
		window.history.replaceState(null, '', '/hearth/');
		const socket = {
			close: vi.fn(),
			addEventListener: vi.fn(),
			subscribeMessage: vi.fn(async () => async () => {})
		} as unknown as Connection;
		vi.mocked(getAuth).mockResolvedValue({ expired: false } as Auth);
		vi.mocked(createConnection).mockResolvedValue(socket);

		await authentication({ hassUrl: 'https://example.ui.nabu.casa' });

		expect(getAuth).toHaveBeenCalledWith(
			expect.objectContaining({
				hassUrl: 'https://example.ui.nabu.casa',
				redirectUrl: 'http://localhost:3000/hearth/'
			})
		);
	});

	it('reuses the authenticated Home Assistant browser session in Ingress', async () => {
		window.history.replaceState(null, '', '/api/hassio_ingress/session-token/');
		const sharedTokens = {
			access_token: 'existing-access-token',
			refresh_token: 'existing-refresh-token',
			hassUrl: 'http://localhost:3000'
		};
		localStorage.setItem('hassTokens', JSON.stringify(sharedTokens));
		const socket = {
			close: vi.fn(),
			addEventListener: vi.fn(),
			subscribeMessage: vi.fn(async () => async () => {})
		} as unknown as Connection;
		vi.mocked(getAuth).mockImplementation(async (options) => {
			if (!options) throw new Error('expected getAuth options');
			expect(await options.loadTokens?.()).toEqual(sharedTokens);
			expect(options.hassUrl).toBe('http://localhost:3000');
			expect(options.redirectUrl).toBeUndefined();
			return { expired: false } as Auth;
		});
		vi.mocked(createConnection).mockResolvedValue(socket);

		await authentication({ hassUrl: 'https://example.ui.nabu.casa' });

		expect(getAuth).toHaveBeenCalledOnce();
		expect(localStorage.getItem('hearthTokens')).toBeNull();
	});

	it('does not start an invalid OAuth redirect when the Ingress session is unavailable', async () => {
		window.history.replaceState(null, '', '/api/hassio_ingress/session-token/');

		await expect(authentication({ hassUrl: 'https://example.ui.nabu.casa' })).rejects.toThrow(
			'The Home Assistant browser session is unavailable to Ingress'
		);

		expect(getAuth).not.toHaveBeenCalled();
	});

	it('does not clear the Home Assistant-owned session after an Ingress auth error', async () => {
		window.history.replaceState(null, '', '/api/hassio_ingress/session-token/');
		const sharedTokens = {
			access_token: 'existing-access-token',
			refresh_token: 'existing-refresh-token',
			hassUrl: 'https://example.ui.nabu.casa'
		};
		localStorage.setItem('hassTokens', JSON.stringify(sharedTokens));
		vi.mocked(getAuth).mockRejectedValue(ERR_INVALID_AUTH);
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(authentication({ hassUrl: 'https://example.ui.nabu.casa' })).rejects.toBe(
			ERR_INVALID_AUTH
		);

		expect(JSON.parse(localStorage.getItem('hassTokens') ?? 'null')).toEqual(sharedTokens);
	});
});
