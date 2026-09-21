/** Normalize Node socket addresses without trusting forwarded headers. */
/** @param {string | undefined} address */
export function normalizeClientAddress(address) {
	if (!address) return undefined;
	const zone = address.indexOf('%');
	const normalized = zone === -1 ? address : address.slice(0, zone);
	return normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
}

/** Parse the add-on's JSON list, with a comma-separated fallback for local use. */
/** @param {string | undefined} value */
export function parseTrustedClients(value) {
	if (!value) return new Set();
	try {
		const parsed = JSON.parse(value);
		if (Array.isArray(parsed)) {
			return new Set(parsed.map((entry) => normalizeClientAddress(String(entry))).filter(Boolean));
		}
	} catch {
		// Accept a concise environment value outside the add-on.
	}
	return new Set(
		value
			.split(',')
			.map((entry) => normalizeClientAddress(entry.trim()))
			.filter(Boolean)
	);
}

/**
 * @param {{ socket?: { remoteAddress?: string }, headers?: Record<string, unknown> }} request
 * @param {boolean} directAccess
 * @param {Set<string>} trustedClients
 */
export function isTrustedDirectRequest(request, directAccess, trustedClients) {
	if (!directAccess) return false;
	const address = normalizeClientAddress(request.socket?.remoteAddress);
	return Boolean(address && trustedClients.has(address));
}

/** @param {string} httpTarget */
export function supervisorWebsocketTarget(httpTarget) {
	const target = new URL(httpTarget);
	target.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:';
	target.pathname = '/core/websocket';
	target.search = '';
	target.hash = '';
	return target.toString();
}

/** Replace only the browser's WebSocket auth credential. */
/**
 * @param {import('ws').RawData | string} data
 * @param {string} supervisorToken
 */
export function supervisorAuthMessage(data, supervisorToken) {
	let message;
	try {
		message = JSON.parse(typeof data === 'string' ? data : data.toString('utf8'));
	} catch {
		return undefined;
	}
	if (message?.type !== 'auth') return undefined;
	return JSON.stringify({ ...message, access_token: supervisorToken });
}
