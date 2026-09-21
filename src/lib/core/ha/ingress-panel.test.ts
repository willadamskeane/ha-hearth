import { describe, expect, it, vi } from 'vitest';
import { announceIngressPanel } from './ingress-panel';

function fakeWindow({
	pathname = '/api/hassio_ingress/token/',
	origin = 'http://homeassistant.local:8123',
	framed = true
} = {}) {
	const postMessage = vi.fn();
	const win: { parent: unknown; location: { pathname: string; origin: string } } = {
		parent: framed ? { postMessage } : undefined,
		location: { pathname, origin }
	};
	if (!framed) win.parent = win;
	return { win: win as unknown as Window, postMessage };
}

describe('announceIngressPanel', () => {
	it('asks the hosting frontend to hide its panel chrome', () => {
		const { win, postMessage } = fakeWindow();
		expect(announceIngressPanel(win)).toBe(true);
		expect(postMessage).toHaveBeenCalledWith(
			{
				type: 'home-assistant/subscribe-properties',
				kioskMode: true,
				handleSafeArea: false
			},
			'http://homeassistant.local:8123'
		);
	});

	it('stays quiet when the page is not framed', () => {
		const { win, postMessage } = fakeWindow({ framed: false });
		expect(announceIngressPanel(win)).toBe(false);
		expect(postMessage).not.toHaveBeenCalled();
	});

	it('stays quiet outside Supervisor Ingress', () => {
		const { win, postMessage } = fakeWindow({ pathname: '/' });
		expect(announceIngressPanel(win)).toBe(false);
		expect(postMessage).not.toHaveBeenCalled();
	});

	it('does nothing without a window', () => {
		expect(announceIngressPanel(undefined)).toBe(false);
	});
});
