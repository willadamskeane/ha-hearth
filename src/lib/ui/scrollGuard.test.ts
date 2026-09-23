import { describe, expect, it, vi } from 'vitest';
import {
	SCROLL_TAP_COOLDOWN_MS,
	scrolledRecently,
	suppressScrollTaps,
	tapSuppressed
} from './scrollGuard';

function press(pointerType = 'touch') {
	const event = new Event('pointerdown');
	Object.defineProperty(event, 'pointerType', { value: pointerType });
	window.dispatchEvent(event);
}

const pointerClick = () => new MouseEvent('click', { detail: 1, bubbles: true, cancelable: true });

function pressAfterScroll() {
	window.dispatchEvent(new Event('scroll'));
	press();
}

describe('scrollGuard', () => {
	it('suppresses the click of a press that began just after a scroll', () => {
		pressAfterScroll();
		const now = performance.now();
		expect(scrolledRecently(now)).toBe(true);
		expect(tapSuppressed(pointerClick(), now)).toBe(true);
		// the cooldown and the gesture both run out
		expect(scrolledRecently(now + SCROLL_TAP_COOLDOWN_MS + 1)).toBe(false);
		expect(tapSuppressed(pointerClick(), now + 2000)).toBe(false);
	});

	it('never suppresses mouse clicks, which follow a wheel scroll on purpose', () => {
		window.dispatchEvent(new Event('scroll'));
		press('mouse');
		expect(tapSuppressed(pointerClick())).toBe(false);
	});

	it('never suppresses keyboard clicks', () => {
		pressAfterScroll();
		expect(tapSuppressed(new MouseEvent('click', { detail: 0 }))).toBe(false);
	});

	it('swallows suppressed clicks before controls inside the node see them', () => {
		const frame = document.createElement('section');
		const button = document.createElement('button');
		const onClick = vi.fn();
		button.addEventListener('click', onClick);
		frame.append(button);
		document.body.append(frame);
		const action = suppressScrollTaps(frame);

		pressAfterScroll();
		button.dispatchEvent(pointerClick());
		expect(onClick).not.toHaveBeenCalled();

		action?.destroy?.();
		button.dispatchEvent(pointerClick());
		expect(onClick).toHaveBeenCalledOnce();
		frame.remove();
	});

	it('lets a press on a page that has settled through', () => {
		vi.useFakeTimers();
		try {
			window.dispatchEvent(new Event('scroll'));
			vi.advanceTimersByTime(SCROLL_TAP_COOLDOWN_MS + 50);
			press();
			expect(tapSuppressed(pointerClick())).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});
});
