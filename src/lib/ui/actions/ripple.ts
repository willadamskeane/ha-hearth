import { pressNearScroll } from '$lib/ui/scrollGuard';

interface RippleOptions {
	color?: string;
	opacity?: number;
	spreadingDuration?: string;
	spreadingTimingFunction?: string;
	clearingDuration?: string;
	clearingTimingFunction?: string;
}

const defaults: RippleOptions = {
	color: 'rgba(255, 255, 255, 0.15)',
	opacity: 0.5,
	spreadingDuration: '300ms',
	spreadingTimingFunction: 'ease-in-out',
	clearingDuration: '350ms',
	clearingTimingFunction: 'ease-in-out'
};

/**
 * How long a touch waits before showing its ripple. A finger that starts a
 * scroll moves or is cancelled within this, so the tiles it slides over don't
 * all flash as if pressed (the same delay native lists use for press states).
 */
export const TOUCH_RIPPLE_DELAY_MS = 90;
const SLOP_PX = 10;

export default function Ripple(node: HTMLElement, options: RippleOptions = {}) {
	let opts = { ...defaults, ...options };

	function show(event: PointerEvent) {
		const rect = node.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const size = Math.max(rect.width, rect.height) * 2;

		const ripple = document.createElement('span');
		ripple.style.cssText = `
			position: absolute;
			border-radius: 50%;
			pointer-events: none;
			width: ${size}px;
			height: ${size}px;
			left: ${x - size / 2}px;
			top: ${y - size / 2}px;
			background: ${opts.color};
			opacity: 0;
			transform: scale(0);
			transition: transform ${opts.spreadingDuration} ${opts.spreadingTimingFunction},
			            opacity ${opts.spreadingDuration} ${opts.spreadingTimingFunction};
		`;

		const computedPosition = getComputedStyle(node).position;
		if (computedPosition === 'static') {
			node.style.position = 'relative';
		}
		node.style.overflow = 'hidden';

		node.appendChild(ripple);

		requestAnimationFrame(() => {
			ripple.style.transform = 'scale(1)';
			ripple.style.opacity = String(opts.opacity);
		});

		return function clear() {
			ripple.style.transition = `opacity ${opts.clearingDuration} ${opts.clearingTimingFunction}`;
			ripple.style.opacity = '0';
			ripple.addEventListener('transitionend', () => ripple.remove(), { once: true });
			// Fallback removal
			setTimeout(() => ripple.remove(), 1000);
		};
	}

	function handlePointerDown(event: PointerEvent) {
		if (pressNearScroll(event)) return;
		const delay = event.pointerType === 'touch' ? TOUCH_RIPPLE_DELAY_MS : 0;
		let clear: (() => void) | undefined;
		const timer = delay ? setTimeout(() => (clear = show(event)), delay) : undefined;
		if (!delay) clear = show(event);

		function stop() {
			clearTimeout(timer);
			clear?.();
			window.removeEventListener('pointerup', release);
			window.removeEventListener('pointercancel', stop);
			window.removeEventListener('pointermove', move);
			window.removeEventListener('scroll', stop, true);
		}
		function release() {
			// a quick tap still gets its ripple, on release
			if (!clear) {
				clearTimeout(timer);
				clear = show(event);
			}
			stop();
		}
		function move(next: PointerEvent) {
			if (next.pointerId !== event.pointerId || clear) return;
			if (
				Math.abs(next.clientX - event.clientX) > SLOP_PX ||
				Math.abs(next.clientY - event.clientY) > SLOP_PX
			)
				stop();
		}

		window.addEventListener('pointerup', release);
		window.addEventListener('pointercancel', stop);
		if (delay) {
			window.addEventListener('pointermove', move, { passive: true });
			window.addEventListener('scroll', stop, { capture: true, passive: true });
		}
	}

	node.addEventListener('pointerdown', handlePointerDown);

	return {
		update(newOptions: RippleOptions) {
			opts = { ...defaults, ...newOptions };
		},
		destroy() {
			node.removeEventListener('pointerdown', handlePointerDown);
		}
	};
}
