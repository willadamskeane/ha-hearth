import { act, render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from '$lib/core/ha/testing';
import { DEFAULT_HEARTH_CONFIG, type HearthConfig } from './config';
import { cancelEdit, currentRoom, enterEditMode, hearthConfig, hearthEditMode } from './store';
import { FOLD_QUERY } from './breakpoints';
import { hasStripWidgets, hiddenOnMobile } from './widgets';
import HearthDashboard from './HearthDashboard.svelte';

vi.mock('$lib/core/ha/registry', () => ({ fetchRegistry: vi.fn(() => new Promise(() => {})) }));

/*
 * The folded (narrow) layout keeps both the fork's status strip and upstream's
 * split rail: the strip carries the glance widgets above the page, and the
 * rail runs above and below it draw only what the strip and page switcher do
 * not already show.
 */

// mediaQuery caches its stores per query, so the fold must match before the
// first render in this file
function stubNarrow() {
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query === FOLD_QUERY,
		addEventListener() {},
		removeEventListener() {}
	}));
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			disconnect() {}
		}
	);
	Element.prototype.scrollTo ??= () => {};
	Element.prototype.scrollIntoView ??= () => {};
	Element.prototype.animate ??= () =>
		({ cancel() {}, finished: Promise.resolve() }) as unknown as Animation;
}

function withRail(rail: HearthConfig['rail']): HearthConfig {
	return {
		...structuredClone(DEFAULT_HEARTH_CONFIG),
		rail,
		rooms: [{ id: 'home', name: 'Home', icon: 'home', cards: [[]] }]
	};
}

describe('HearthDashboard folded layout', () => {
	beforeAll(stubNarrow);
	beforeEach(() => {
		stubNarrow();
		states.set({ 'weather.home': hassEntity('weather.home', 'sunny', { temperature: 20 }) });
	});

	afterEach(() => {
		if (get(hearthEditMode)) cancelEdit();
		hearthConfig.set(structuredClone(DEFAULT_HEARTH_CONFIG));
		currentRoom.set('home');
		history.replaceState(null, '', '/');
		vi.unstubAllGlobals();
	});

	it('shows the glance widgets in the status strip instead of a rail run above the page', () => {
		hearthConfig.set(
			withRail([
				{ id: 'clock', type: 'clock' },
				{ id: 'weather', type: 'weather', entity: 'weather.home' },
				{ id: 'nav', type: 'nav' }
			])
		);
		const { container } = render(HearthDashboard);
		expect(container.querySelector('.status-strip')).not.toBeNull();
		expect(container.querySelectorAll('.status-strip .chip').length).toBeGreaterThan(0);
		// nothing is left for either run to draw
		expect(container.querySelector('.rail-run')).toBeNull();
	});

	it('keeps the other widgets in a folded run without repeating the strip ones', () => {
		hearthConfig.set(
			withRail([
				{ id: 'clock', type: 'clock' },
				{ id: 'spacer', type: 'spacer' },
				{ id: 'status', type: 'status', text: 'Hello' }
			])
		);
		const { container } = render(HearthDashboard);
		const trailing = container.querySelector('.rail-run.trailing');
		expect(trailing).not.toBeNull();
		expect(trailing!.querySelector('[data-id="status"]')).not.toBeNull();
		expect(container.querySelector('.rail-run [data-id="clock"]')).toBeNull();
	});

	it('brings every widget back into the runs while editing', async () => {
		hearthConfig.set(
			withRail([
				{ id: 'clock', type: 'clock' },
				{ id: 'status', type: 'status', text: 'Hello' }
			])
		);
		const { container } = render(HearthDashboard);
		await act(() => enterEditMode());
		expect(container.querySelector('.rail-run [data-id="clock"]')).not.toBeNull();
		expect(container.querySelector('.status-strip')).toBeNull();
	});
});

describe('hiddenOnMobile', () => {
	it('lets an explicit mobile slot override the legacy flag', () => {
		expect(hiddenOnMobile({ id: 'c', type: 'clock', hide_mobile: true })).toBe(true);
		expect(hiddenOnMobile({ id: 'c', type: 'clock', mobile: 'hidden' })).toBe(true);
		expect(hiddenOnMobile({ id: 'c', type: 'clock', hide_mobile: true, mobile: 'top' })).toBe(
			false
		);
		expect(hiddenOnMobile({ id: 'c', type: 'clock' })).toBe(false);
	});

	it('drops a strip widget hidden on mobile from the status strip', () => {
		expect(hasStripWidgets([{ id: 'c', type: 'clock', mobile: 'hidden' }])).toBe(false);
		expect(hasStripWidgets([{ id: 'c', type: 'clock', mobile: 'bottom' }])).toBe(true);
	});
});
