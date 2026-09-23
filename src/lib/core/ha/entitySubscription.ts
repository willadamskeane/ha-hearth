import { writable } from 'svelte/store';
import type { Connection, HassEntities, HassEntity } from 'home-assistant-js-websocket';

/*
 * Entity states over Home Assistant's `subscribe_entities`, limited to a scope.
 * home-assistant-js-websocket's subscribeEntities always subscribes to every
 * entity and copies the whole state table on each update; a dashboard shows a
 * small fraction of a house, and on a wall tablet that copying was most of the
 * page's idle script time. Hearth scopes the subscription to what it shows and
 * widens it to everything while an editor or search needs the whole house.
 */

/** Entity ids to subscribe to, or null for every entity. */
export const entityScope = writable<string[] | null>(null);

interface CompressedState {
	s: string;
	a?: Record<string, unknown>;
	c?: string | { id: string; parent_id?: string | null; user_id?: string | null };
	lc: number;
	lu?: number;
}

interface CompressedChange {
	'+'?: Partial<CompressedState>;
	'-'?: { a?: string[] };
}

/** One `subscribe_entities` event: entities added, changed and removed. */
export interface EntityEvent {
	a?: Record<string, CompressedState>;
	c?: Record<string, CompressedChange>;
	r?: string[];
}

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

function context(
	value: CompressedState['c'],
	previous?: HassEntity['context']
): HassEntity['context'] {
	if (typeof value === 'string')
		return { ...(previous ?? { parent_id: null, user_id: null }), id: value };
	return { parent_id: null, user_id: null, ...previous, ...value } as HassEntity['context'];
}

/**
 * Applies one event to a state table and returns the next table. Unchanged
 * entities keep their object identity, which the per-entity stores rely on to
 * skip listeners.
 */
export function applyEntityEvent(current: HassEntities, event: EntityEvent): HassEntities {
	const next: HassEntities = { ...current };
	for (const [entityId, added] of Object.entries(event.a ?? {})) {
		const lastChanged = iso(added.lc);
		next[entityId] = {
			entity_id: entityId,
			state: added.s,
			attributes: added.a ?? {},
			context: context(added.c),
			last_changed: lastChanged,
			last_updated: added.lu ? iso(added.lu) : lastChanged
		} as HassEntity;
	}
	for (const entityId of event.r ?? []) delete next[entityId];
	for (const [entityId, change] of Object.entries(event.c ?? {})) {
		const previous = next[entityId];
		if (!previous) continue;
		const entity = { ...previous };
		const add = change['+'];
		const remove = change['-'];
		if (add?.a || remove?.a) entity.attributes = { ...previous.attributes, ...(add?.a ?? {}) };
		for (const key of remove?.a ?? []) delete entity.attributes[key];
		if (add?.s !== undefined) entity.state = add.s;
		if (add?.c) entity.context = context(add.c, previous.context);
		if (add?.lc) entity.last_updated = entity.last_changed = iso(add.lc);
		else if (add?.lu) entity.last_updated = iso(add.lu);
		next[entityId] = entity;
	}
	return next;
}

/**
 * Subscribes to the entities in `scope` (null: all) and reports the whole
 * scoped table after every event. Resubscribes itself after a reconnect.
 */
export function subscribeScopedEntities(
	conn: Connection,
	scope: string[] | null,
	onStates: (states: HassEntities) => void
): () => void {
	let states: HassEntities = {};
	let active = true;
	const subscription = conn.subscribeMessage<EntityEvent>(
		(event) => {
			if (!active) return;
			states = applyEntityEvent(states, event);
			onStates(states);
		},
		scope === null
			? { type: 'subscribe_entities' }
			: { type: 'subscribe_entities', entity_ids: scope },
		{ resubscribe: true }
	);
	subscription.catch((error) => console.error('entity subscription failed', error));
	return () => {
		active = false;
		void subscription.then((unsubscribe) => unsubscribe()).catch(() => {});
	};
}
