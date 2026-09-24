import type { Connection } from 'home-assistant-js-websocket';
import type Hls from 'hls.js';

type Signal =
	| { type: 'session'; session_id: string }
	| { type: 'answer'; answer: string }
	| { type: 'candidate'; candidate: RTCIceCandidateInit }
	| { type: 'error'; message: string };

const streamTypes = new Map<string, 'web_rtc' | 'hls'>();

/**
 * How to play a camera: WebRTC when Home Assistant offers it, else HLS.
 * Home Assistant 2024.11 stopped setting the `frontend_stream_type` attribute
 * and reports stream types through `camera/capabilities` instead, so without
 * the attribute this asks (once per camera per page load). WebRTC starts in
 * about a second; HLS waits for Home Assistant to build segments, ~8 s cold.
 */
export async function resolveStreamType(
	connection: Connection,
	entity: string,
	attribute: string | undefined
): Promise<'web_rtc' | 'hls'> {
	if (attribute) return attribute === 'web_rtc' ? 'web_rtc' : 'hls';
	const known = streamTypes.get(entity);
	if (known) return known;
	try {
		const capabilities = await connection.sendMessagePromise<{
			frontend_stream_types?: string[];
		}>({ type: 'camera/capabilities', entity_id: entity });
		const type = capabilities.frontend_stream_types?.includes('web_rtc') ? 'web_rtc' : 'hls';
		streamTypes.set(entity, type);
		return type;
	} catch {
		return 'hls';
	}
}

/** Forget cached stream types (tests). */
export function clearStreamTypes() {
	streamTypes.clear();
}

/** One playback session. Aborting releases media and signaling, including pending setup. */
export async function playCamera(
	connection: Connection,
	video: HTMLVideoElement,
	entity: string,
	streamType: string | undefined,
	signal: AbortSignal,
	onError: () => void
): Promise<void> {
	if (signal.aborted) return;
	let hls: Hls | undefined;
	let peer: RTCPeerConnection | undefined;
	let unsubscribe: (() => Promise<void>) | undefined;
	let media: MediaStream | undefined;
	let closed = false;
	const dispose = () => {
		if (closed) return;
		closed = true;
		hls?.destroy();
		peer?.close();
		media?.getTracks().forEach((track) => track.stop());
		void unsubscribe?.().catch(() => {});
		video.pause();
		video.srcObject = null;
		video.removeAttribute('src');
		video.load();
		signal.removeEventListener('abort', dispose);
	};
	const fail = () => {
		if (!closed) {
			dispose();
			onError();
		}
	};
	signal.addEventListener('abort', dispose, { once: true });
	try {
		const type = await resolveStreamType(connection, entity, streamType);
		if (closed) return;
		if (type !== 'web_rtc') {
			const response = await connection.sendMessagePromise<{ url?: string }>({
				type: 'camera/stream',
				entity_id: entity
			});
			if (closed) return;
			if (!response.url) throw new Error('Camera did not return a stream');
			if (video.canPlayType('application/vnd.apple.mpegurl')) {
				video.src = response.url;
			} else {
				const { default: Player } = await import('hls.js');
				if (closed) return;
				if (!Player.isSupported()) throw new Error('HLS playback is unavailable');
				hls = new Player({ backBufferLength: 30, lowLatencyMode: true });
				hls.on(Player.Events.ERROR, (_event, data) => {
					if (data.fatal) fail();
				});
				hls.loadSource(response.url);
				hls.attachMedia(video);
			}
			void video.play().catch(() => {});
			return;
		}

		const options = await connection.sendMessagePromise<{
			configuration?: RTCConfiguration;
			dataChannel?: string;
		}>({ type: 'camera/webrtc/get_client_config', entity_id: entity });
		if (closed) return;
		peer = new RTCPeerConnection(options.configuration);
		const activePeer = peer;
		media = new MediaStream();
		video.srcObject = media;
		if (options.dataChannel) peer.createDataChannel(options.dataChannel);
		peer.addTransceiver('audio', { direction: 'recvonly' });
		peer.addTransceiver('video', { direction: 'recvonly' });
		peer.ontrack = (event) => {
			if (!closed) media?.addTrack(event.track);
		};
		peer.onconnectionstatechange = () => {
			if (activePeer.connectionState === 'failed') fail();
		};
		let session: string | undefined;
		const candidates: RTCIceCandidateInit[] = [];
		const sendCandidate = (candidate: RTCIceCandidateInit) => {
			if (!closed && session)
				void connection
					.sendMessagePromise({
						type: 'camera/webrtc/candidate',
						entity_id: entity,
						session_id: session,
						candidate
					})
					.catch(fail);
		};
		peer.onicecandidate = (event) => {
			if (closed || !event.candidate) return;
			if (session) sendCandidate(event.candidate.toJSON());
			else candidates.push(event.candidate.toJSON());
		};
		const offer = await peer.createOffer();
		if (closed) return;
		await peer.setLocalDescription(offer);
		if (closed) return;
		// Serialize signals so candidates cannot overtake the remote description.
		let signals = Promise.resolve();
		const stop = await connection.subscribeMessage<Signal>(
			(event) => {
				signals = signals
					.then(async () => {
						if (closed) return;
						if (event.type === 'session') {
							session = event.session_id;
							candidates.splice(0).forEach(sendCandidate);
						} else if (event.type === 'answer') {
							await activePeer.setRemoteDescription({ type: 'answer', sdp: event.answer });
						} else if (event.type === 'candidate') {
							await activePeer.addIceCandidate({
								...event.candidate,
								sdpMid: event.candidate.sdpMid ?? '0'
							});
						} else fail();
					})
					.catch(fail);
			},
			{ type: 'camera/webrtc/offer', entity_id: entity, offer: offer.sdp }
		);
		if (closed) {
			await stop();
			return;
		}
		unsubscribe = stop;
		void video.play().catch(() => {});
	} catch {
		fail();
	}
}
