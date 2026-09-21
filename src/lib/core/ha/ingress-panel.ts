/**
 * Home Assistant wraps an add-on's Ingress frame in `ha-panel-app`, which draws
 * its own title bar directly above the frame. That bar lives in the component's
 * shadow root, so no stylesheet from inside the frame can hide it: the component
 * only drops it once `hass.kioskMode` is set.
 *
 * Kiosk mode is enabled by the `hass-kiosk-mode` window event, and `ha-panel-app`
 * fires it when the frame asks. The request has to come from this window, because
 * the handler ignores anything whose `event.source` is not the frame's
 * `contentWindow`, which also means a parent page cannot post it on our behalf.
 * Home Assistant 2026.9 has no `?kiosk` URL parameter left, so this handshake is
 * the only way for an add-on to hide its own panel chrome.
 */
const SUBSCRIBE_PROPERTIES = 'home-assistant/subscribe-properties';

/** Only frames served through Supervisor Ingress may ask for frontend chrome changes. */
function isIngressPath(pathname: string) {
	return pathname.startsWith('/api/hassio_ingress/');
}

/**
 * Ask the Home Assistant frontend hosting this Ingress frame to hide its panel
 * chrome. No-op outside Ingress, or when nothing is framing us, so the same page
 * keeps working standalone. `handleSafeArea` stays off because Hearth already
 * applies `env(safe-area-inset-*)` itself and would otherwise inset twice.
 *
 * Returns whether the request was sent, which is what the tests assert on.
 */
export function announceIngressPanel(
	win: Window | undefined = typeof window === 'undefined' ? undefined : window
): boolean {
	if (!win || win.parent === win) return false;
	if (!isIngressPath(win.location.pathname)) return false;
	win.parent.postMessage(
		{ type: SUBSCRIBE_PROPERTIES, kioskMode: true, handleSafeArea: false },
		win.location.origin
	);
	return true;
}
