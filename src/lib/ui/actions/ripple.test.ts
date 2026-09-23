import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Ripple, { TOUCH_RIPPLE_DELAY_MS } from './ripple';

function pointer(type: string, pointerType: string, clientX = 10, clientY = 10) {
	const event = new Event(type) as PointerEvent;
	Object.defineProperties(event, {
		pointerType: { value: pointerType },
		pointerId: { value: 1 },
		clientX: { value: clientX },
		clientY: { value: clientY }
	});
	return event;
}

describe('Ripple', () => {
	let node: HTMLElement;
	const ripples = () => node.querySelectorAll('span').length;

	beforeEach(() => {
		vi.useFakeTimers();
		node = document.createElement('div');
		document.body.append(node);
		Ripple(node);
	});

	afterEach(() => {
		node.remove();
		vi.useRealTimers();
	});

	it('shows a mouse press at once', () => {
		node.dispatchEvent(pointer('pointerdown', 'mouse'));
		expect(ripples()).toBe(1);
	});

	it('holds a touch ripple back briefly, then shows it', () => {
		node.dispatchEvent(pointer('pointerdown', 'touch'));
		expect(ripples()).toBe(0);
		vi.advanceTimersByTime(TOUCH_RIPPLE_DELAY_MS);
		expect(ripples()).toBe(1);
	});

	it('shows a quick touch tap on release', () => {
		node.dispatchEvent(pointer('pointerdown', 'touch'));
		window.dispatchEvent(pointer('pointerup', 'touch'));
		expect(ripples()).toBe(1);
	});

	it('drops the ripple of a touch that turns into a scroll', () => {
		node.dispatchEvent(pointer('pointerdown', 'touch'));
		window.dispatchEvent(pointer('pointermove', 'touch', 10, 30));
		vi.advanceTimersByTime(TOUCH_RIPPLE_DELAY_MS);
		window.dispatchEvent(pointer('pointerup', 'touch', 10, 30));
		expect(ripples()).toBe(0);

		node.dispatchEvent(pointer('pointerdown', 'touch'));
		window.dispatchEvent(pointer('pointercancel', 'touch'));
		vi.advanceTimersByTime(TOUCH_RIPPLE_DELAY_MS);
		expect(ripples()).toBe(0);
	});

	it('shows nothing for a touch that lands while the page scrolls', () => {
		window.dispatchEvent(new Event('scroll'));
		node.dispatchEvent(pointer('pointerdown', 'touch'));
		vi.advanceTimersByTime(TOUCH_RIPPLE_DELAY_MS);
		window.dispatchEvent(pointer('pointerup', 'touch'));
		expect(ripples()).toBe(0);
	});
});
