import { describe, expect, it } from 'vitest';
import type { HassEntities } from 'home-assistant-js-websocket';
import { configEntityIds, dashboardEntityScope } from './entityScope';

const allIds = [
	'light.desk',
	'light.shelf',
	'light.kitchen',
	'light.kitchen_1',
	'light.kitchen_2',
	'sensor.temperature',
	'sensor.unused',
	'binary_sensor.door',
	'media_player.den',
	'media_player.kitchen_speaker',
	'sun.sun'
];

describe('configEntityIds', () => {
	it('finds entity ids anywhere in the config, including wildcards, and ignores other strings', () => {
		const config = {
			rail: [{ type: 'status', entity: 'sensor.temperature' }],
			rooms: [
				{
					temp_entity: 'sensor.temperature',
					cards: [
						[
							{
								type: 'entities',
								entities: [{ entity: 'light.desk', name: 'light.shelf is not a name' }],
								visibility: [{ entity: 'binary_sensor.door', state: 'on' }]
							},
							{ type: 'entities', wildcard: 'light.kitchen_*', entities: [] }
						]
					]
				}
			]
		};
		expect(configEntityIds(config, allIds)).toEqual([
			'binary_sensor.door',
			'light.desk',
			'light.kitchen_1',
			'light.kitchen_2',
			'sensor.temperature',
			'sun.sun'
		]);
	});
});

describe('dashboardEntityScope', () => {
	const states = {
		'light.kitchen': {
			attributes: { entity_id: ['light.kitchen_1', 'light.kitchen_2', 'light.gone'] }
		},
		'media_player.den': { attributes: { group_members: ['media_player.kitchen_speaker'] } }
	} as unknown as HassEntities;

	it('adds group members that exist and extra ids such as a popup entity', () => {
		expect(
			dashboardEntityScope(['light.kitchen', 'media_player.den'], allIds, states, [
				'sensor.unused',
				'switch.missing'
			])
		).toEqual([
			'light.kitchen',
			'light.kitchen_1',
			'light.kitchen_2',
			'media_player.den',
			'media_player.kitchen_speaker',
			'sensor.unused'
		]);
	});
});
