import { fireEvent, render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { cameraCard, cameraEntities } from '../../model/cards/camera';
import { hearthEditMode, popup } from '../../store';
import { hassEntity } from '../../testing';
import Card from './Card.svelte';

const picture = (id: string) => ({
	friendly_name: id.replace('camera.', ''),
	entity_picture: `/api/camera_proxy/${id}`
});

describe('camera card', () => {
	afterEach(() => {
		popup.set(null);
		hearthEditMode.set(false);
	});

	it('normalizes a list of cameras, which takes over from a single entity', () => {
		const card = cameraCard.normalize({
			entity: 'camera.a',
			entities: [' camera.b ', '', 3]
		} as never);
		expect(card.entities).toEqual(['camera.b']);
		expect(cameraEntities(card)).toEqual(['camera.b']);
		expect(cameraEntities({ entity: 'camera.a' })).toEqual(['camera.a']);
		expect(cameraCard.needsConfiguration?.(cameraCard.normalize({} as never) as never)).toBe(true);
	});

	it('shows several cameras as named snapshots that open the live view', async () => {
		states.set({
			'camera.driveway': hassEntity('camera.driveway', 'recording', picture('camera.driveway')),
			'camera.backyard': hassEntity('camera.backyard', 'recording', picture('camera.backyard'))
		});
		const { getByRole, container } = render(Card, {
			card: { id: 'cams', type: 'camera', entities: ['camera.driveway', 'camera.backyard'] }
		});
		expect(container.querySelectorAll('.thumb img')).toHaveLength(2);
		await fireEvent.click(getByRole('button', { name: 'backyard' }));
		expect(get(popup)).toMatchObject({ kind: 'detail', entity: 'camera.backyard' });
	});

	it('does not open cameras while editing', async () => {
		hearthEditMode.set(true);
		states.set({ 'camera.a': hassEntity('camera.a', 'idle', picture('camera.a')) });
		const { getByRole } = render(Card, {
			card: { id: 'cams', type: 'camera', entities: ['camera.a', 'camera.b'] }
		});
		await fireEvent.click(getByRole('button', { name: 'a' }));
		expect(get(popup)).toBeNull();
	});

	it('keeps the single-camera player for one camera', () => {
		states.set({ 'camera.a': hassEntity('camera.a', 'idle', picture('camera.a')) });
		const { container, queryAllByRole } = render(Card, {
			card: { id: 'cam', type: 'camera', entity: 'camera.a' }
		});
		expect(container.querySelector('.camera video')).not.toBeNull();
		expect(queryAllByRole('button')).toHaveLength(0);
	});
});
