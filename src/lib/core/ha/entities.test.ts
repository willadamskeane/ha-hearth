import { get } from 'svelte/store';
import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	cancelQueuedStates,
	entityIds,
	entityState,
	entityStates,
	queueStates,
	states
} from './entities';

function entity(id: string, state: string): HassEntity {
	return {
		entity_id: id,
		state,
		attributes: {},
		last_changed: '',
		last_updated: '',
		context: { id: '', user_id: null, parent_id: null }
	};
}

afterEach(() => {
	cancelQueuedStates();
	vi.unstubAllGlobals();
});

describe('entity state delivery', () => {
	it('only notifies an entity selector when that entity changed', () => {
		const light = entity('light.desk', 'off');
		const sensor = entity('sensor.room', '20');
		states.set({ 'light.desk': light, 'sensor.room': sensor } as HassEntities);
		const seen: Array<string | undefined> = [];
		const stop = entityState('light.desk').subscribe((value) => seen.push(value?.state));

		states.set({ 'light.desk': light, 'sensor.room': entity('sensor.room', '21') } as HassEntities);
		states.set({ 'light.desk': entity('light.desk', 'on'), 'sensor.room': sensor } as HassEntities);

		expect(seen).toEqual(['off', 'on']);
		stop();
	});

	it('coalesces websocket bursts into one frame update', () => {
		let flush: FrameRequestCallback | undefined;
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
			flush = callback;
			return 7;
		});
		vi.stubGlobal('cancelAnimationFrame', vi.fn());
		queueStates({ 'sensor.room': entity('sensor.room', '20') } as HassEntities);
		queueStates({ 'sensor.room': entity('sensor.room', '21') } as HassEntities);
		expect(get(states)?.['sensor.room']?.state).not.toBe('21');
		flush?.(0);
		expect(get(states)['sensor.room'].state).toBe('21');
	});

	it('publishes selected maps and entity ids only when their inputs change', () => {
		const light = entity('light.desk', 'off');
		const sensor = entity('sensor.room', '20');
		states.set({ 'light.desk': light, 'sensor.room': sensor } as HassEntities);
		const selected: string[] = [];
		const ids: string[][] = [];
		const stopSelected = entityStates(['light.desk']).subscribe((value) =>
			selected.push(value['light.desk']?.state)
		);
		const stopIds = entityIds.subscribe((value) => ids.push(value));

		states.set({ 'light.desk': light, 'sensor.room': entity('sensor.room', '21') } as HassEntities);
		states.set({ 'light.desk': entity('light.desk', 'on'), 'sensor.room': sensor } as HassEntities);
		states.set({ 'light.desk': light } as HassEntities);

		expect(selected).toEqual(['off', 'on', 'off']);
		expect(ids).toEqual([['light.desk', 'sensor.room'], ['light.desk']]);
		stopSelected();
		stopIds();
	});
});
