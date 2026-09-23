import { afterEach, describe, expect, it, vi } from 'vitest';
import { haptics } from '$lib/core/app/haptics';
import { horizontalDrag, onDndReceive } from './drag';

class TestNode extends EventTarget {
	setPointerCapture = vi.fn();
	releasePointerCapture = vi.fn();
	getBoundingClientRect() {
		return { left: 10, width: 200 } as DOMRect;
	}
}

function pointer(type: string, clientX: number, clientY = 0, pointerType = 'touch') {
	const event = new Event(type) as PointerEvent;
	Object.defineProperties(event, {
		clientX: { value: clientX },
		clientY: { value: clientY },
		pointerType: { value: pointerType },
		pointerId: { value: 1 }
	});
	return event;
}

/** The click a browser sends after a pointer tap (detail 1), or a keyboard one (0). */
function click(detail = 1) {
	return new MouseEvent('click', { detail });
}

describe('horizontalDrag touch feedback', () => {
	const vibrateSpy = vi.fn<(timings: VibratePattern) => boolean>(() => true);

	afterEach(() => {
		haptics.set(false);
		vi.unstubAllGlobals();
		Reflect.deleteProperty(navigator, 'vibrate');
	});

	function asPhone() {
		// jsdom serves an insecure origin, which the haptics layer refuses
		Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
		Object.defineProperty(navigator, 'vibrate', { value: vibrateSpy, configurable: true });
		vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
		vibrateSpy.mockClear();
		haptics.set(true);
	}

	it('ticks once per step crossed and once on the commit', () => {
		asPhone();
		const node = new TestNode();
		horizontalDrag(node as unknown as HTMLElement, { set: vi.fn(), step: 25 });

		node.dispatchEvent(pointer('pointerdown', 10));
		// drift below the threshold is not a drag yet, so it is silent
		node.dispatchEvent(pointer('pointermove', 15));
		// 25% and 50% cross two step boundaries
		node.dispatchEvent(pointer('pointermove', 60));
		node.dispatchEvent(pointer('pointermove', 110));
		// the same step again is silent
		node.dispatchEvent(pointer('pointermove', 112));
		expect(vibrateSpy).toHaveBeenCalledTimes(2);

		node.dispatchEvent(pointer('pointerup', 210));
		expect(vibrateSpy).toHaveBeenCalledTimes(3);
	});

	it('stays silent while the drag stays inside the step it started in', () => {
		asPhone();
		const node = new TestNode();
		horizontalDrag(node as unknown as HTMLElement, { set: vi.fn(), step: 25 });

		// down at 0%, dragged to 12%: past the movement threshold, same step
		node.dispatchEvent(pointer('pointerdown', 10));
		node.dispatchEvent(pointer('pointermove', 34));
		expect(vibrateSpy).not.toHaveBeenCalled();
	});

	it('stays silent for a tap, which sets no value', () => {
		asPhone();
		const node = new TestNode();
		horizontalDrag(node as unknown as HTMLElement, { set: vi.fn(), tap: vi.fn() });

		node.dispatchEvent(pointer('pointerdown', 20));
		node.dispatchEvent(pointer('pointerup', 24));
		expect(vibrateSpy).not.toHaveBeenCalled();
	});
});

describe('horizontalDrag', () => {
	it('previews continuously, commits the endpoint and removes listeners', () => {
		const node = new TestNode();
		const set = vi.fn();
		const end = vi.fn();
		const action = horizontalDrag(node as unknown as HTMLElement, { set, end });

		node.dispatchEvent(pointer('pointerdown', 20));
		node.dispatchEvent(pointer('pointermove', 110));
		node.dispatchEvent(pointer('pointerup', 210));
		expect(set).toHaveBeenNthCalledWith(1, 50, true);
		expect(set).toHaveBeenNthCalledWith(2, 100, true);
		expect(end).toHaveBeenCalledWith(100);

		action?.destroy?.();
		node.dispatchEvent(pointer('pointerdown', 20));
		node.dispatchEvent(pointer('pointermove', 110));
		expect(set).toHaveBeenCalledTimes(2);
	});

	it('uses a tap below the movement threshold and honors updated options', () => {
		const node = new TestNode();
		const firstTap = vi.fn();
		const secondTap = vi.fn();
		const action = horizontalDrag(node as unknown as HTMLElement, { set: vi.fn(), tap: firstTap });
		action?.update?.({ set: vi.fn(), tap: secondTap });
		node.dispatchEvent(pointer('pointerdown', 20));
		node.dispatchEvent(pointer('pointerup', 24));
		// the tap waits for the browser's click
		expect(secondTap).not.toHaveBeenCalled();
		node.dispatchEvent(click());
		expect(firstTap).not.toHaveBeenCalled();
		expect(secondTap).toHaveBeenCalledOnce();
	});

	it('does not turn ordinary ten-pixel tap drift into a value change', () => {
		const node = new TestNode();
		const set = vi.fn();
		const tap = vi.fn();
		horizontalDrag(node as unknown as HTMLElement, { set, tap });
		node.dispatchEvent(pointer('pointerdown', 20));
		node.dispatchEvent(pointer('pointermove', 30));
		node.dispatchEvent(pointer('pointerup', 30));
		node.dispatchEvent(click());
		expect(tap).toHaveBeenCalledOnce();
		expect(set).not.toHaveBeenCalled();
	});

	it('cleans up a cancelled gesture without committing or tapping', () => {
		const node = new TestNode();
		const set = vi.fn();
		const tap = vi.fn();
		const action = horizontalDrag(node as unknown as HTMLElement, { set, tap });

		node.dispatchEvent(pointer('pointerdown', 20));
		node.dispatchEvent(pointer('pointercancel', 25));
		node.dispatchEvent(pointer('pointerup', 210));
		node.dispatchEvent(click());

		expect(set).not.toHaveBeenCalled();
		expect(tap).not.toHaveBeenCalled();
		expect(node.releasePointerCapture).toHaveBeenCalledWith(1);
		action?.destroy?.();
	});

	it('does not tap after vertical drift beyond the slop, and sets no value', () => {
		const node = new TestNode();
		const set = vi.fn();
		const tap = vi.fn();
		horizontalDrag(node as unknown as HTMLElement, { set, tap });
		node.dispatchEvent(pointer('pointerdown', 20, 100));
		node.dispatchEvent(pointer('pointermove', 22, 115));
		node.dispatchEvent(pointer('pointerup', 22, 115));
		node.dispatchEvent(click());
		expect(tap).not.toHaveBeenCalled();
		expect(set).not.toHaveBeenCalled();
	});

	it('does not tap when the browser sends no click, as for a touch that stops a fling', () => {
		const node = new TestNode();
		const tap = vi.fn();
		horizontalDrag(node as unknown as HTMLElement, { set: vi.fn(), tap });
		node.dispatchEvent(pointer('pointerdown', 20));
		node.dispatchEvent(pointer('pointerup', 20));
		// a later click from an unrelated gesture (or the keyboard) must not use it
		node.dispatchEvent(pointer('pointerdown', 20));
		node.dispatchEvent(click(0));
		expect(tap).not.toHaveBeenCalled();
	});

	it('ignores keyboard clicks, which the element handles itself', () => {
		const node = new TestNode();
		const tap = vi.fn();
		horizontalDrag(node as unknown as HTMLElement, { set: vi.fn(), tap });
		node.dispatchEvent(click(0));
		expect(tap).not.toHaveBeenCalled();
	});

	it('does not tap or hold for a press that begins while the page is scrolling', () => {
		vi.useFakeTimers();
		try {
			const node = new TestNode();
			const tap = vi.fn();
			const hold = vi.fn();
			horizontalDrag(node as unknown as HTMLElement, { set: vi.fn(), tap, hold });
			window.dispatchEvent(new Event('scroll'));
			node.dispatchEvent(pointer('pointerdown', 20));
			vi.advanceTimersByTime(600);
			node.dispatchEvent(pointer('pointerup', 20));
			node.dispatchEvent(click());
			expect(tap).not.toHaveBeenCalled();
			expect(hold).not.toHaveBeenCalled();

			// a mouse click right after a wheel scroll is deliberate
			window.dispatchEvent(new Event('scroll'));
			node.dispatchEvent(pointer('pointerdown', 20, 0, 'mouse'));
			node.dispatchEvent(pointer('pointerup', 20, 0, 'mouse'));
			node.dispatchEvent(click());
			expect(tap).toHaveBeenCalledOnce();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('onDndReceive', () => {
	it('forwards detail, stops bubbling, and detaches on destroy', () => {
		const node = new TestNode();
		const handler = vi.fn();
		const action = onDndReceive(node as unknown as HTMLElement, handler);
		const event = new Event('dndreceive', { bubbles: true }) as CustomEvent;
		Object.defineProperty(event, 'detail', { value: { id: 'card', newIndex: 2 } });
		const stop = vi.spyOn(event, 'stopPropagation');
		node.dispatchEvent(event);
		expect(handler).toHaveBeenCalledWith({ id: 'card', newIndex: 2 });
		expect(stop).toHaveBeenCalledOnce();
		action?.destroy?.();
		node.dispatchEvent(event);
		expect(handler).toHaveBeenCalledOnce();
	});
});
