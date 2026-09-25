/**
 * Resolve the Home Assistant URL that is safe to expose to the browser.
 *
 * HASS_URL is the browser-facing URL for standalone deployments, but the
 * Home Assistant add-on uses it as an internal proxy target. In add-on mode,
 * only trusted Supervisor Ingress headers or an explicitly exposed host port
 * may supply the browser-facing URL.
 *
 * `publicHassUrl` (PUBLIC_HASS_URL) overrides everything. `directPublicHassUrl`
 * (upstream's HASS_PUBLIC_URL) only applies to direct access: Ingress keeps the
 * forwarded origin the browser is already on.
 *
 * @param {import('node:http').IncomingHttpHeaders} headers
 * @param {{
 *   addon: boolean;
 *   hassUrl?: string;
 *   publicHassUrl?: string;
 *   directPublicHassUrl?: string;
 *   hassPort?: string;
 *   exposedPort?: string;
 *   secure?: boolean;
 * }} environment
 */
export function resolvePublicHassUrl(headers, environment) {
	if (environment.publicHassUrl) return environment.publicHassUrl;
	if (!environment.addon) return environment.directPublicHassUrl || environment.hassUrl;

	const forwardedProto = firstHeader(headers['x-forwarded-proto']);
	const forwardedHost = firstHeader(headers['x-forwarded-host']);
	if (isTrustedIngressRequest(headers)) {
		return `${forwardedProto}://${forwardedHost}`;
	}

	if (environment.directPublicHassUrl) return environment.directPublicHassUrl;

	const host = firstHeader(headers.host);
	if (!host || !environment.exposedPort || !environment.hassPort) return undefined;

	const protocol = environment.secure ? 'https' : 'http';
	const url = new URL(`${protocol}://${host}`);
	const requestPort = url.port || (protocol === 'https' ? '443' : '80');
	if (requestPort !== environment.exposedPort) return undefined;
	url.port = environment.hassPort;
	return url.origin;
}

/**
 * Return whether the request came through Supervisor Ingress.
 *
 * Kiosk Satellite can rewrite the browser path to a short proxy route, so the
 * request-level marker is more reliable than matching `/api/hassio_ingress/`.
 *
 * @param {import('node:http').IncomingHttpHeaders} headers
 */
export function isTrustedIngressRequest(headers) {
	const source = firstHeader(headers['x-hass-source']);
	const forwardedProto = firstHeader(headers['x-forwarded-proto']);
	const forwardedHost = firstHeader(headers['x-forwarded-host']);
	return (
		source === 'core.ingress' &&
		(forwardedProto === 'http' || forwardedProto === 'https') &&
		Boolean(forwardedHost)
	);
}

/** @param {string | string[] | undefined} value */
function firstHeader(value) {
	return Array.isArray(value) ? value[0] : value;
}
