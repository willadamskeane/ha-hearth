import { get, writable, type Readable, type Subscriber, type Writable } from 'svelte/store';
import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { domainDescriptor } from '../domains';

const backingStates = writable<HassEntities>();
const backingEntityIds = writable<string[]>([]);
let latestStates: HassEntities | undefined;
let latestEntityIds: string[] = [];
const entityListeners = new Map<string, Set<Subscriber<HassEntity | undefined>>>();
const entitySetListeners = new Set<{
	ids: Set<string>;
	run: Subscriber<HassEntities>;
}>();

function publishStates(next: HassEntities | undefined) {
	const previous = latestStates;
	latestStates = next;
	backingStates.set(next as HassEntities);
	const nextIds = Object.keys(next ?? {});
	if (
		nextIds.length !== latestEntityIds.length ||
		nextIds.some((entityId, index) => entityId !== latestEntityIds[index])
	) {
		latestEntityIds = nextIds;
		backingEntityIds.set(nextIds);
	}
	for (const [entityId, listeners] of entityListeners) {
		const before = previous?.[entityId];
		const after = next?.[entityId];
		if (before === after) continue;
		for (const listener of listeners) listener(after);
	}
	for (const listener of entitySetListeners) {
		if (![...listener.ids].some((entityId) => previous?.[entityId] !== next?.[entityId])) continue;
		listener.run(selectEntities(next, listener.ids));
	}
}

function selectEntities(
	source: HassEntities | undefined,
	entityIds: Iterable<string>
): HassEntities {
	const selected: HassEntities = {};
	for (const entityId of entityIds) {
		const entity = source?.[entityId];
		if (entity) selected[entityId] = entity;
	}
	return selected;
}

/** Every entity state. Prefer entityState() in runtime components. */
export const states: Writable<HassEntities> = {
	subscribe: backingStates.subscribe,
	set: publishStates,
	update(updater) {
		publishStates(updater(latestStates as HassEntities));
	}
};

/**
 * A selector store that only notifies when this entity's object changed. The
 * websocket library preserves object identity for unchanged entities, so an
 * unrelated sensor update costs no Svelte work in subscribers.
 */
export function entityState(entityId: string | undefined): Readable<HassEntity | undefined> {
	return {
		subscribe(run) {
			if (!entityId) {
				run(undefined);
				return () => {};
			}
			let listeners = entityListeners.get(entityId);
			if (!listeners) entityListeners.set(entityId, (listeners = new Set()));
			listeners.add(run);
			run(latestStates?.[entityId]);
			return () => {
				listeners?.delete(run);
				if (listeners?.size === 0) entityListeners.delete(entityId);
			};
		}
	};
}

/** A small state map that updates only when one of the requested entities changes. */
export function entityStates(entityIds: string[] | undefined): Readable<HassEntities> {
	const ids = new Set(entityIds?.filter(Boolean) ?? []);
	return {
		subscribe(run) {
			const listener = { ids, run };
			entitySetListeners.add(listener);
			run(selectEntities(latestStates, ids));
			return () => entitySetListeners.delete(listener);
		}
	};
}

let queuedStates: HassEntities | undefined;
let queuedFrame: number | ReturnType<typeof setTimeout> | undefined;

/** Coalesce websocket bursts into at most one application update per frame. */
export function queueStates(next: HassEntities): void {
	queuedStates = next;
	if (queuedFrame !== undefined) return;
	const flush = () => {
		queuedFrame = undefined;
		const current = queuedStates;
		queuedStates = undefined;
		if (current) publishStates(current);
	};
	queuedFrame =
		typeof requestAnimationFrame === 'function'
			? requestAnimationFrame(flush)
			: setTimeout(flush, 0);
}

export function cancelQueuedStates(): void {
	if (queuedFrame !== undefined) {
		if (typeof cancelAnimationFrame === 'function' && typeof queuedFrame === 'number') {
			cancelAnimationFrame(queuedFrame);
		} else {
			clearTimeout(queuedFrame as ReturnType<typeof setTimeout>);
		}
	}
	queuedFrame = undefined;
	queuedStates = undefined;
}

/**
 * Returns the domain from a given entity_id
 * @example getDomain("light.bedroom") // "light"
 */
export function getDomain(entityId: string | undefined) {
	return entityId?.split('.')?.[0];
}

export type EntityAvailability = 'available' | 'unavailable' | 'unknown' | 'missing';

/** The shared reachability vocabulary for every entity surface. */
export function entityAvailability(entity: HassEntity | undefined): EntityAvailability {
	if (!entity) return 'missing';
	if (entity.state === 'unavailable') return 'unavailable';
	if (entity.state === 'unknown') return 'unknown';
	return 'available';
}

export function entityAvailable(entity: HassEntity | undefined): boolean {
	return entityAvailability(entity) === 'available';
}

/**
 * Whether a command may be sent to the entity. Missing and unavailable
 * entities cannot act; `unknown` can, since scenes, buttons and scripts report
 * it until their first use.
 */
export function entityControllable(entity: HassEntity | undefined): boolean {
	const availability = entityAvailability(entity);
	return availability === 'available' || availability === 'unknown';
}

export const UNAVAILABLE_STATES = ['unavailable', 'unknown'];

/** States that indicate activity across Home Assistant domains. */
export const ACTIVE_STATES = [
	'active',
	'auto',
	'cool',
	'dry',
	'fan_only',
	'heat',
	'heat_cool',
	'heating',
	'home',
	'on',
	'open',
	'playing',
	'unlocking',
	'unlocked',
	// vacuum
	'cleaning',
	'returning',
	// water_heater
	'eco',
	'electric',
	'performance',
	'high_demand',
	'heat_pump',
	'gas'
];

/** One domain-aware answer to whether an entity is visually active. */
export function entityActive(entityId: string, entity: HassEntity | undefined) {
	if (!entity) return false;
	return (
		domainDescriptor(getDomain(entityId)).active?.(entity) ?? ACTIVE_STATES.includes(entity.state)
	);
}

/** Active state with an optimistic `active:` override applied while the entity is reachable. */
export function entityActiveFor(
	entityId: string,
	entity: HassEntity | undefined,
	$overrides: Record<string, number>
): boolean {
	const override = entityAvailable(entity) ? $overrides[`active:${entityId}`] : undefined;
	return override === undefined ? entityActive(entityId, entity) : override > 0;
}

/** The `domain.service` that flips an entity, or undefined for domains without one. */
export function getTogglableService(entity: HassEntity) {
	if (!entity?.state) return;
	return domainDescriptor(getDomain(entity.entity_id)).toggleService?.(entity);
}

/** Parses a sensor state as a number, or null for anything non-numeric. */
export function sensorNumber(state: string | undefined): number | null {
	// a number, optionally followed by a unit after whitespace ("12.5 °C");
	// "12abc" is not a reading, which parseFloat alone would accept as 12
	const match = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?(?=\s|$)/.exec(state?.trim() ?? '');
	if (!match) return null;
	const value = Number(match[0]);
	return Number.isFinite(value) ? value : null;
}

/* entity groups */

/** Active/inactive wording for one entity. */
export function summaryWords(entityId: string, entity: HassEntity | undefined): [string, string] {
	return domainDescriptor(getDomain(entityId)).summaryWords?.(entity) ?? ['on', 'off'];
}

/**
 * Collapsed-group caption, e.g. "5 open · 3 closed". Entities without an on/off
 * notion (sensors) and entities that are unavailable are not counted, since
 * calling either of those "off" would be a lie; a group with nothing countable
 * falls back to its size. Wording follows the group's entities only while they
 * agree - a mixed group says on/off. `badge` is the active half alone, for the
 * popover header.
 */
export interface EntityGroupSummary {
	/** Every entity in the group, countable or not. */
	total: number;
	/** False when no entity's domain counts; the caller then reports the size. */
	countable: boolean;
	active: number;
	inactive: number;
	/** Translation keys for the active and inactive halves, e.g. on/off, open/closed. */
	activeWord: string;
	inactiveWord: string;
}

export function entityGroupSummary(
	entityIds: string[],
	$states: HassEntities | undefined
): EntityGroupSummary {
	// eligible by domain, so the wording holds before any state has arrived
	const eligible = entityIds.filter(
		(entityId) => domainDescriptor(getDomain(entityId)).countable === true
	);
	if (!eligible.length) {
		return {
			total: entityIds.length,
			countable: false,
			active: 0,
			inactive: 0,
			activeWord: 'on',
			inactiveWord: 'off'
		};
	}
	// counted only where the state says something: an unavailable or not yet
	// loaded entity is neither active nor inactive
	const countable = eligible.filter((entityId) => {
		const entity = $states?.[entityId];
		return entity !== undefined && !UNAVAILABLE_STATES.includes(entity.state);
	});
	const words = eligible.map((entityId) => summaryWords(entityId, $states?.[entityId]));
	const [activeWord, inactiveWord] = words.every(
		([active, inactive]) => active === words[0][0] && inactive === words[0][1]
	)
		? words[0]
		: (['on', 'off'] as [string, string]);
	const active = countable.filter((entityId) => entityActive(entityId, $states?.[entityId])).length;
	return {
		total: entityIds.length,
		countable: true,
		active,
		inactive: countable.length - active,
		activeWord,
		inactiveWord
	};
}

/** Every entity id currently in the state table; ordinary state changes do not republish it. */
export const entityIds: Readable<string[]> = { subscribe: backingEntityIds.subscribe };

const backingAllEntityIds = writable<string[]>([]);

/**
 * Every entity id in the house, from the last unscoped snapshot. While the
 * subscription is scoped to a dashboard the state table holds only its
 * entities, so anything that matches against the whole house (wildcard cards,
 * the scope itself) reads this instead.
 */
export const allEntityIds: Readable<string[]> = { subscribe: backingAllEntityIds.subscribe };

export function setAllEntityIds(ids: string[]): void {
	const current = get(backingAllEntityIds);
	if (current.length === ids.length && current.every((id, index) => id === ids[index])) return;
	backingAllEntityIds.set(ids);
}

/** Which of the named feature bits are set in supported_features. */
export function getSupport(
	supportedFeatures: number | undefined,
	features: Record<string, unknown>
): Record<string, boolean> {
	if (!supportedFeatures) return {};
	return Object.entries(features).reduce((supports: Record<string, boolean>, [key, value]) => {
		if (typeof value === 'number') supports[key] = (supportedFeatures & value) !== 0;
		return supports;
	}, {});
}
