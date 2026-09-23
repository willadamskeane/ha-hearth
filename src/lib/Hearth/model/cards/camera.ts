import * as v from 'valibot';
import type { OverviewCard } from '../../types';
import { trimmedOrUndefined } from '../../normalizers';
import type { CardDefinition } from '../types';
import { OptionalText, OptionalEntityId, OptionalEntityIdList, OptionalFlag } from '../../schema';

export type CameraCard = Extract<OverviewCard, { type: 'camera' }>;

/** The cameras a card shows: its list, or else its single entity. */
export function cameraEntities(card: Pick<CameraCard, 'entity' | 'entities'>): string[] {
	if (card.entities?.length) return card.entities;
	return card.entity ? [card.entity] : [];
}

export const cameraCard: CardDefinition<CameraCard> = {
	type: 'camera',
	label: 'hearth_card_camera_label',
	name: 'hearth_card_camera_name',
	sub: 'hearth_card_camera_sub',
	icon: 'videocam',
	normalize: (card) => ({
		entity: trimmedOrUndefined(card.entity),
		entities: Array.isArray(card.entities)
			? card.entities
					.filter(
						(entry: unknown): entry is string => typeof entry === 'string' && entry.trim() !== ''
					)
					.map((entry) => entry.trim())
			: undefined,
		title: trimmedOrUndefined(card.title),
		stream: typeof card.stream === 'boolean' ? card.stream : undefined
	}),
	schema: v.looseObject({
		entity: OptionalEntityId,
		entities: OptionalEntityIdList,
		title: OptionalText,
		stream: OptionalFlag
	}),
	needsConfiguration: (card) => cameraEntities(card).length === 0,
	entityIds: cameraEntities
};
