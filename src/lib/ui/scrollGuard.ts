import type { Action } from 'svelte/action';

/*
 * Taps that belong to a scroll. A finger that lands while the page is still
 * moving (or has only just stopped) is almost always meant to stop or steer the
 * scroll, not to press whatever is under it; native platforms treat it that
 * way, and on a wall of light tiles pressing it anyway toggles a light. Chrome
 * already withholds `click` for the touch that stops a fling, but not for one
 * that lands a moment after the scroll settles, and not for anything driven by
 * raw pointer events, so Hearth guards clicks itself. Only touch and pen
 * presses are guarded: a mouse click just after a wheel scroll is deliberate.
 */

/** A touch that starts this soon after a scroll does not activate controls. */
export const SCROLL_TAP_COOLDOWN_MS = 300;
/** How long after its pointerdown a click still counts as the same gesture. */
const GESTURE_MS = 1000;

let lastScrollAt = -Infinity;
let lastDownAt = -Infinity;
let lastDownNearScroll = false;

if (typeof window !== 'undefined') {
	addEventListener('scroll', () => (lastScrollAt = performance.now()), {
		capture: true,
		passive: true
	});
	addEventListener(
		'pointerdown',
		(event: PointerEvent) => {
			lastDownAt = performance.now();
			lastDownNearScroll = scrolledRecently(lastDownAt) && isDirect(event);
		},
		{ capture: true, passive: true }
	);
}

/** A finger or stylus on the screen, which can stop or steer a scroll. */
function isDirect(event: PointerEvent) {
	return event.pointerType === 'touch' || event.pointerType === 'pen';
}

/** Whether the page scrolled within the cooldown. */
export function scrolledRecently(now = performance.now()): boolean {
	return now - lastScrollAt < SCROLL_TAP_COOLDOWN_MS;
}

/** Whether a press starting now is one that belongs to a scroll. */
export function pressNearScroll(event: PointerEvent, now = performance.now()): boolean {
	return isDirect(event) && scrolledRecently(now);
}

/**
 * Whether the pointer gesture in progress began near a scroll, so its click
 * must not activate anything. Keyboard activation (a click without a pointer
 * gesture behind it) is never suppressed.
 */
export function tapSuppressed(event?: MouseEvent, now = performance.now()): boolean {
	if (event && event.detail === 0) return false;
	return lastDownNearScroll && now - lastDownAt < GESTURE_MS;
}

/**
 * Swallows, before any handler sees them, pointer clicks from gestures that
 * began near a scroll, for every control inside the node.
 */
export const suppressScrollTaps: Action<HTMLElement> = (node) => {
	function guard(event: MouseEvent) {
		if (!tapSuppressed(event)) return;
		event.stopImmediatePropagation();
		event.preventDefault();
	}
	node.addEventListener('click', guard, { capture: true });
	return {
		destroy() {
			node.removeEventListener('click', guard, { capture: true });
		}
	};
};
