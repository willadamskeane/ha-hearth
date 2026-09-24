import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';
import { clearStreamTypes, playCamera, resolveStreamType } from './camera';

afterEach(() => {
	vi.unstubAllGlobals();
	clearStreamTypes();
});

function videoElement() {
	return {
		src: '',
		srcObject: null,
		canPlayType: vi.fn(() => 'probably'),
		play: vi.fn(async () => {}),
		pause: vi.fn(),
		load: vi.fn(),
		removeAttribute: vi.fn()
	} as unknown as HTMLVideoElement;
}

describe('camera session ownership', () => {
	it('disposes native HLS playback once when its owner aborts', async () => {
		const sendMessagePromise = vi.fn(async () => ({ url: '/api/hls/stream.m3u8' }));
		const connection = { sendMessagePromise } as unknown as Connection;
		const controller = new AbortController();
		const video = videoElement();
		const onError = vi.fn();
		await playCamera(connection, video, 'camera.door', 'hls', controller.signal, onError);
		expect(video.src).toBe('/api/hls/stream.m3u8');
		controller.abort();
		controller.abort();
		expect(video.pause).toHaveBeenCalledTimes(1);
		expect(video.removeAttribute).toHaveBeenCalledWith('src');
		expect(onError).not.toHaveBeenCalled();
	});

	it('cannot attach a stream returned after cancellation', async () => {
		let resolve!: (value: { url: string }) => void;
		const connection = {
			sendMessagePromise: () => new Promise((r) => (resolve = r))
		} as unknown as Connection;
		const controller = new AbortController();
		const video = videoElement();
		const loading = playCamera(connection, video, 'camera.door', 'hls', controller.signal, vi.fn());
		// cancel while the stream request is in flight
		await vi.waitFor(() => expect(resolve).toBeDefined());
		controller.abort();
		resolve({ url: '/late.m3u8' });
		await loading;
		expect(video.src).toBe('');
		expect(video.play).not.toHaveBeenCalled();
	});

	it('reports a failed stream request and releases the media element', async () => {
		const connection = {
			sendMessagePromise: vi.fn().mockRejectedValue(new Error('offline'))
		} as unknown as Connection;
		const video = videoElement();
		const onError = vi.fn();
		await playCamera(
			connection,
			video,
			'camera.door',
			'hls',
			new AbortController().signal,
			onError
		);
		expect(onError).toHaveBeenCalledTimes(1);
		expect(video.pause).toHaveBeenCalledTimes(1);
	});

	it('closes WebRTC media and an asynchronously established signaling subscription', async () => {
		const close = vi.fn(),
			stopTrack = vi.fn(),
			unsubscribe = vi.fn(async () => {});
		vi.stubGlobal(
			'RTCPeerConnection',
			class {
				addTransceiver = vi.fn();
				createOffer = vi.fn(async () => ({ sdp: 'offer' }));
				setLocalDescription = vi.fn(async () => {});
				close = close;
			}
		);
		vi.stubGlobal(
			'MediaStream',
			class {
				getTracks() {
					return [{ stop: stopTrack }];
				}
			}
		);
		let resolve!: (stop: () => Promise<void>) => void;
		const subscribeMessage = vi.fn(() => new Promise((r) => (resolve = r)));
		const connection = {
			sendMessagePromise: vi.fn(async () => ({})),
			subscribeMessage
		} as unknown as Connection;
		const video = videoElement(),
			controller = new AbortController();
		const loading = playCamera(
			connection,
			video,
			'camera.door',
			'web_rtc',
			controller.signal,
			vi.fn()
		);
		await vi.waitFor(() => expect(subscribeMessage).toHaveBeenCalledOnce());
		controller.abort();
		resolve(unsubscribe);
		await loading;
		expect(close).toHaveBeenCalledOnce();
		expect(stopTrack).toHaveBeenCalledOnce();
		expect(unsubscribe).toHaveBeenCalledOnce();
		expect(video.srcObject).toBeNull();
	});
});

describe('stream type', () => {
	function connectionWith(capabilities: unknown) {
		const sendMessagePromise = vi.fn(async (message: { type: string }) =>
			message.type === 'camera/capabilities' ? capabilities : { url: '/api/hls/stream.m3u8' }
		);
		return { sendMessagePromise, connection: { sendMessagePromise } as unknown as Connection };
	}

	it('asks Home Assistant for the stream types when the attribute is gone, once per camera', async () => {
		const { connection, sendMessagePromise } = connectionWith({
			frontend_stream_types: ['web_rtc']
		});
		expect(await resolveStreamType(connection, 'camera.door', undefined)).toBe('web_rtc');
		expect(await resolveStreamType(connection, 'camera.door', undefined)).toBe('web_rtc');
		expect(sendMessagePromise).toHaveBeenCalledTimes(1);
		expect(sendMessagePromise).toHaveBeenCalledWith({
			type: 'camera/capabilities',
			entity_id: 'camera.door'
		});
	});

	it('uses HLS when WebRTC is not offered or the question fails', async () => {
		expect(
			await resolveStreamType(
				connectionWith({ frontend_stream_types: ['hls'] }).connection,
				'camera.a',
				undefined
			)
		).toBe('hls');
		const failing = {
			sendMessagePromise: vi.fn().mockRejectedValue(new Error('unknown command'))
		} as unknown as Connection;
		expect(await resolveStreamType(failing, 'camera.b', undefined)).toBe('hls');
	});

	it('trusts a legacy frontend_stream_type attribute without asking', async () => {
		const { connection, sendMessagePromise } = connectionWith({});
		expect(await resolveStreamType(connection, 'camera.c', 'web_rtc')).toBe('web_rtc');
		expect(await resolveStreamType(connection, 'camera.c', 'hls')).toBe('hls');
		expect(sendMessagePromise).not.toHaveBeenCalled();
	});

	it('plays over HLS only after capabilities rule out WebRTC', async () => {
		const { connection, sendMessagePromise } = connectionWith({ frontend_stream_types: ['hls'] });
		const video = videoElement();
		await playCamera(
			connection,
			video,
			'camera.hls',
			undefined,
			new AbortController().signal,
			vi.fn()
		);
		expect(sendMessagePromise.mock.calls.map(([m]) => m.type)).toEqual([
			'camera/capabilities',
			'camera/stream'
		]);
		expect(video.src).toBe('/api/hls/stream.m3u8');
	});
});
