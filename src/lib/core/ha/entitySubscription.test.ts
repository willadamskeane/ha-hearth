import { describe, expect, it, vi } from 'vitest';
import { applyEntityEvent, subscribeScopedEntities, type EntityEvent } from './entitySubscription';

describe('applyEntityEvent', () => {
	const added: EntityEvent = {
		a: {
			'light.desk': { s: 'on', a: { brightness: 200 }, c: 'ctx1', lc: 1_700_000_000 },
			'sensor.temp': {
				s: '21',
				a: { unit_of_measurement: '°C' },
				c: 'ctx2',
				lc: 1_700_000_000,
				lu: 1_700_000_060
			}
		}
	};

	it('expands added entities', () => {
		const states = applyEntityEvent({}, added);
		expect(states['light.desk']).toMatchObject({
			entity_id: 'light.desk',
			state: 'on',
			attributes: { brightness: 200 },
			context: { id: 'ctx1', parent_id: null, user_id: null },
			last_changed: '2023-11-14T22:13:20.000Z',
			last_updated: '2023-11-14T22:13:20.000Z'
		});
		expect(states['sensor.temp'].last_updated).toBe('2023-11-14T22:14:20.000Z');
	});

	it('changes state and attributes, keeping untouched entities identical', () => {
		const before = applyEntityEvent({}, added);
		const after = applyEntityEvent(before, {
			c: {
				'light.desk': {
					'+': { s: 'off', a: { color_mode: 'onoff' }, lc: 1_700_000_100 },
					'-': { a: ['brightness'] }
				}
			}
		});
		expect(after['light.desk']).toMatchObject({
			state: 'off',
			attributes: { color_mode: 'onoff' },
			last_changed: '2023-11-14T22:15:00.000Z'
		});
		expect(after['light.desk'].attributes).not.toHaveProperty('brightness');
		expect(before['light.desk'].attributes).toHaveProperty('brightness');
		expect(after['sensor.temp']).toBe(before['sensor.temp']);
	});

	it('removes entities and ignores changes to unknown ones', () => {
		const before = applyEntityEvent({}, added);
		const after = applyEntityEvent(before, {
			r: ['sensor.temp'],
			c: { 'switch.x': { '+': { s: 'on' } } }
		});
		expect(Object.keys(after)).toEqual(['light.desk']);
	});
});

describe('subscribeScopedEntities', () => {
	function fakeConnection() {
		let handler: ((event: EntityEvent) => void) | undefined;
		const unsubscribe = vi.fn();
		const conn = {
			subscribeMessage: vi.fn(
				(
					...args: [callback: (event: EntityEvent) => void, message: unknown, options?: unknown]
				) => {
					handler = args[0];
					return Promise.resolve(unsubscribe);
				}
			)
		};
		return { conn, unsubscribe, emit: (event: EntityEvent) => handler?.(event) };
	}

	it('asks for just the scoped entities, or every entity for a null scope', () => {
		const scoped = fakeConnection();
		subscribeScopedEntities(scoped.conn as never, ['light.desk'], () => {});
		expect(scoped.conn.subscribeMessage.mock.calls[0][1]).toEqual({
			type: 'subscribe_entities',
			entity_ids: ['light.desk']
		});
		const all = fakeConnection();
		subscribeScopedEntities(all.conn as never, null, () => {});
		expect(all.conn.subscribeMessage.mock.calls[0][1]).toEqual({ type: 'subscribe_entities' });
	});

	it('reports the table after every event and stops after unsubscribing', async () => {
		const { conn, emit, unsubscribe } = fakeConnection();
		const reports: string[][] = [];
		const stop = subscribeScopedEntities(conn as never, ['light.desk'], (states) =>
			reports.push(Object.keys(states))
		);
		emit({ a: { 'light.desk': { s: 'on', lc: 1 } } });
		stop();
		emit({ a: { 'light.other': { s: 'on', lc: 1 } } });
		await Promise.resolve();
		expect(reports).toEqual([['light.desk']]);
		expect(unsubscribe).toHaveBeenCalledOnce();
	});
});
