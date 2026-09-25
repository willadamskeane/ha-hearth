import type { Action } from 'svelte/action';
import type { SliderUpdateMode } from '$lib/core/app/configuration';
import { vibrate } from '$lib/core/app/haptics';
import { pressNearScroll, tapSuppressed } from '$lib/ui/scrollGuard';

interface DragOptions {
	/** Updates the preview. `commit` says whether device state should also be sent. */
	set: (value: number, commit: boolean) => void;
	tap?: () => void;
	/** Long-press without movement; suppresses the tap for that gesture. */
	hold?: () => void;
	end?: (value: number) => void;
	updateMode?: SliderUpdateMode;
	/** Percentage points between touch-feedback ticks while dragging. */
	step?: number;
	/** Skip gesture handling entirely (used in edit mode so SortableJS gets the pointer) */
	disabled?: boolean;
	/**
	 * Selector for interactive children the gesture must not swallow. Needed
	 * because Svelte 5 delegates the child's own handlers to the app root, so
	 * their stopPropagation runs after this action's native pointerdown -
	 * without this check the tile captures the pointer and the child's click
	 * retargets to the tile.
	 */
	ignore?: string;
	/**
	 * Report the unrounded percentage, for callers that map it onto their own
	 * range and step; whole percents would cap a 0-1000 range at steps of 10.
	 */
	precise?: boolean;
}

/** Movement (in either direction) beyond which a press is no longer a tap. */
const TAP_SLOP_PX = 10;
/** How long after a qualifying pointerup the browser's click may still arrive. */
const ARMED_TAP_MS = 500;

/**
 * Horizontal drag-to-value with tap detection: a press that stays within 10px
 * in both directions counts as a tap, horizontal movement beyond that sets a
 * 0-100 value from the pointer's position within the element. Apply
 * `touch-action: none` (or `pan-y`, to keep vertical scrolling) on the element
 * so touch drags work.
 *
 * The tap fires on the browser's `click`, not on pointerup: the browser
 * withholds click for touches that were really a scroll or stopped a fling,
 * which raw pointer events can't tell apart. A touch that begins while the page
 * is scrolling, or just after, is never a tap (see ui/scrollGuard).
 */
export const horizontalDrag: Action<HTMLElement, DragOptions> = (node, options) => {
	let current = options;
	let tracking: {
		moved: boolean;
		held: boolean;
		pointerId: number;
		startX: number;
		startY: number;
		/** Moved beyond the tap slop in any direction. */
		strayed: boolean;
		/** Began while the page was scrolling or had only just stopped. */
		nearScroll: boolean;
		lastStep: number;
	} | null = null;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	/** When the tap waiting for its click expires; 0 when none is waiting. */
	let armedUntil = 0;

	function stepIndex(value: number) {
		return Math.floor(value / Math.max(1, current.step ?? 5));
	}

	/**
	 * One tick per move that lands on a different step than the last, so a sweep
	 * feels notched. A fast sweep skipping several steps still ticks once: each
	 * vibration cancels the one before it, so a tick per crossed step would only
	 * shorten the buzz.
	 */
	function feedStep(value: number) {
		if (!tracking) return;
		const index = stepIndex(value);
		if (index === tracking.lastStep) return;
		tracking.lastStep = index;
		vibrate('step');
	}

	function fraction(event: PointerEvent) {
		const rect = node.getBoundingClientRect();
		return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
	}

	function percent(event: PointerEvent) {
		const value = fraction(event) * 100;
		return current.precise ? value : Math.round(value);
	}

	function handleDown(event: PointerEvent) {
		if (current.disabled) return;
		if (current.ignore && (event.target as Element).closest?.(current.ignore)) return;
		armedUntil = 0;
		try {
			node.setPointerCapture(event.pointerId);
		} catch {
			// pointer capture is best-effort
		}
		tracking = {
			moved: false,
			held: false,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			strayed: false,
			nearScroll: pressNearScroll(event),
			// the step under the finger, so staying inside it stays silent
			lastStep: stepIndex(Math.round(fraction(event) * 100))
		};
		if (current.hold) {
			holdTimer = setTimeout(() => {
				if (!tracking || tracking.strayed || tracking.nearScroll) return;
				tracking.held = true;
				vibrate('hold');
				current.hold?.();
			}, 500);
		}
	}

	function handleMove(event: PointerEvent) {
		if (!tracking || event.pointerId !== tracking.pointerId || tracking.held) return;
		const dx = Math.abs(event.clientX - tracking.startX);
		const dy = Math.abs(event.clientY - tracking.startY);
		if (dx > TAP_SLOP_PX || dy > TAP_SLOP_PX) {
			tracking.strayed = true;
			clearTimeout(holdTimer);
		}
		if (dx > TAP_SLOP_PX) tracking.moved = true;
		if (tracking.moved) {
			const value = percent(event);
			feedStep(value);
			current.set(value, current.updateMode !== 'release');
		}
	}

	function handleUp(event: PointerEvent) {
		if (!tracking || event.pointerId !== tracking.pointerId) return;
		if (tracking.held) {
			// the hold already acted; the release must not toggle on top of it
		} else if (tracking.moved) {
			const value = percent(event);
			// Always commit the final value. In release mode this is the gesture's
			// only service call; in continuous mode it guarantees the exact endpoint.
			vibrate('commit');
			current.set(value, true);
			current.end?.(value);
		} else if (!tracking.strayed && !tracking.nearScroll && current.tap) {
			// wait for the click, which the browser skips if this was a scroll
			armedUntil = performance.now() + ARMED_TAP_MS;
		}
		finishTracking(event.pointerId);
	}

	function handleClick(event: MouseEvent) {
		const armed = armedUntil > performance.now();
		armedUntil = 0;
		// keyboard clicks (never armed) are the element's own business
		if (!armed || tapSuppressed(event) || current.disabled) return;
		current.tap?.();
	}

	function finishTracking(pointerId: number) {
		clearTimeout(holdTimer);
		tracking = null;
		try {
			node.releasePointerCapture(pointerId);
		} catch {
			// capture may already have been released by the browser
		}
	}

	function handleCancel(event: PointerEvent) {
		if (!tracking || event.pointerId !== tracking.pointerId) return;
		// Cancellation means the browser handed the gesture to scrolling or
		// navigation. Clean up without turning that interruption into a command.
		finishTracking(event.pointerId);
	}

	node.addEventListener('pointerdown', handleDown);
	node.addEventListener('pointermove', handleMove);
	node.addEventListener('pointerup', handleUp);
	node.addEventListener('pointercancel', handleCancel);
	node.addEventListener('click', handleClick);

	return {
		update(next) {
			current = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', handleDown);
			node.removeEventListener('pointermove', handleMove);
			node.removeEventListener('pointerup', handleUp);
			node.removeEventListener('pointercancel', handleCancel);
			node.removeEventListener('click', handleClick);
			if (tracking) finishTracking(tracking.pointerId);
		}
	};
};

export { onDndReceive, type DndReceiveDetail } from '$lib/ui/actions/sortable';
