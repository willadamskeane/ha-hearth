import type { HassEntities } from 'home-assistant-js-websocket';
import { wildcardEntityIds } from './config';

/*
 * The entities a dashboard can show, so the state subscription can be limited
 * to them (see core/ha/entitySubscription). Rather than trusting every card and
 * widget to declare its entities, the whole config is scanned for strings that
 * name a real entity: card and widget fields, visibility conditions, scene
 * indicators, default media devices, room sensors, the day/night entity. On
 * top of that come wildcard matches, the members of any group in scope (a
 * light group's popup lists them), sun.sun (the day/night default) and
 * whatever a popup is showing, which search can open for any entity.
 */

const MEMBER_ATTRIBUTES = ['entity_id', 'group_members'] as const;

/** Entity ids the config names directly or through a wildcard, sorted. */
export function configEntityIds(config: unknown, allIds: readonly string[]): string[] {
	const known = new Set(allIds);
	const found = new Set<string>();
	const visit = (value: unknown) => {
		if (typeof value === 'string') {
			if (known.has(value)) found.add(value);
		} else if (Array.isArray(value)) {
			for (const item of value) visit(item);
		} else if (value && typeof value === 'object') {
			const record = value as Record<string, unknown>;
			if (typeof record.wildcard === 'string')
				for (const id of wildcardEntityIds(record.wildcard, [...allIds])) found.add(id);
			for (const item of Object.values(record)) visit(item);
		}
	};
	visit(config);
	if (known.has('sun.sun')) found.add('sun.sun');
	return [...found].sort();
}

/**
 * The subscription scope: the config's entities, their group members (two
 * levels, read from current states) and any extra ids that exist. Sorted, so
 * two scopes compare by joining.
 */
export function dashboardEntityScope(
	configIds: readonly string[],
	allIds: readonly string[],
	states: HassEntities | undefined,
	extra: (string | undefined)[] = []
): string[] {
	const known = new Set(allIds);
	const scope = new Set(configIds);
	for (const id of extra) if (id && known.has(id)) scope.add(id);
	for (let depth = 0; depth < 2; depth++) {
		for (const id of [...scope]) {
			const attributes = states?.[id]?.attributes;
			if (!attributes) continue;
			for (const key of MEMBER_ATTRIBUTES) {
				const members = attributes[key];
				if (!Array.isArray(members)) continue;
				for (const member of members)
					if (typeof member === 'string' && known.has(member)) scope.add(member);
			}
		}
	}
	return [...scope].sort();
}
