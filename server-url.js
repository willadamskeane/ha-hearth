/**
 * Resolve the Home Assistant URL that is safe to expose to the browser.
 *
 * HASS_URL is the browser-facing URL for standalone deployments, but the
 * Home Assistant add-on uses it as an internal proxy target. In add-on mode,
 * only trusted Supervisor Ingress headers or an explicitly exposed host port
 * may supply the browser-facing URL.
 *
 * @param {import('node:http').IncomingHttpHeaders} headers
 * @param {{
 *   addon: boolean;
 *   hassUrl?: string;
 *   publicHassUrl?: string;
 *   hassPort?: string;
 *   exposedPort?: string;
 *   secure?: boolean;
 * }} environment
 */
export function resolvePublicHassUrl(headers, environment) {
	if (environment.publicHassUrl) return environment.publicHassUrl;
	if (!environment.addon) return environment.hassUrl;

	const source = firstHeader(headers['x-hass-source']);
	const forwardedProto = firstHeader(headers['x-forwarded-proto']);
	const forwardedHost = firstHeader(headers['x-forwarded-host']);
	if (
		source === 'core.ingress' &&
		(forwardedProto === 'http' || forwardedProto === 'https') &&
		forwardedHost
	) {
		return `${forwardedProto}://${forwardedHost}`;
	}

	const host = firstHeader(headers.host);
	if (!host || !environment.exposedPort || !environment.hassPort) return undefined;

	const protocol = environment.secure ? 'https' : 'http';
	const url = new URL(`${protocol}://${host}`);
	const requestPort = url.port || (protocol === 'https' ? '443' : '80');
	if (requestPort !== environment.exposedPort) return undefined;
	url.port = environment.hassPort;
	return url.origin;
}

/** @param {string | string[] | undefined} value */
function firstHeader(value) {
	return Array.isArray(value) ? value[0] : value;
}
