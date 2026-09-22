import { fireEvent, render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { states } from '$lib/core/ha/entities';
import { hassEntity } from './testing';
import EntityTile from './EntityTile.svelte';

vi.mock('$lib/core/domains/entity', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/core/domains/entity')>()),
	toggleEntity: vi.fn()
}));
import { dismissConfirmation, requestedConfirmation } from './store';
import { toggleEntity } from '$lib/core/domains/entity';

describe('EntityTile', () => {
	beforeEach(() => {
		vi.mocked(toggleEntity).mockClear();
		dismissConfirmation();
	});

	it('toggles a switch on tap', async () => {
		states.set({
			'switch.fan': hassEntity('switch.fan', 'on', { friendly_name: 'Fan' })
		});
		render(EntityTile, { entity: 'switch.fan' });
		const tile = screen.getByRole('button');
		expect(screen.getByText('Fan')).toBeTruthy();
		expect(tile.getAttribute('aria-pressed')).toBe('true');
		await fireEvent.click(tile);
		expect(toggleEntity).toHaveBeenCalledWith('switch.fan');
	});

	it('asks before unlocking a lock instead of sending the command', async () => {
		states.set({
			'lock.front': hassEntity('lock.front', 'locked', { friendly_name: 'Front door' })
		});
		render(EntityTile, { entity: 'lock.front' });
		await fireEvent.click(screen.getByRole('button'));
		expect(toggleEntity).not.toHaveBeenCalled();
		expect(get(requestedConfirmation)?.confirmLabel).toBe('Unlock');
	});

	it('renders an unavailable entity as inert with its availability spelled out', async () => {
		states.set({ 'switch.fan': hassEntity('switch.fan', 'unavailable') });
		render(EntityTile, { entity: 'switch.fan' });
		const tile = screen.getByRole('button');
		expect(tile.getAttribute('tabindex')).toBe('-1');
		expect(tile.classList.contains('unreachable')).toBe(true);
		expect(screen.getByText('Unavailable')).toBeTruthy();
		await fireEvent.click(tile);
		expect(toggleEntity).not.toHaveBeenCalled();
	});

	it('keeps a read-only tile out of the tab order and silent on tap', async () => {
		states.set({ 'switch.fan': hassEntity('switch.fan', 'off') });
		render(EntityTile, { entity: 'switch.fan', readonly: true });
		const tile = screen.getByRole('button');
		expect(tile.getAttribute('tabindex')).toBe('-1');
		await fireEvent.click(tile);
		expect(toggleEntity).not.toHaveBeenCalled();
	});

	it('delegates lights and covers to their own tiles', () => {
		states.set({
			'light.desk': hassEntity('light.desk', 'on', { brightness: 255 }),
			'cover.blind': hassEntity('cover.blind', 'open', { current_position: 100 })
		});
		const { container: light } = render(EntityTile, { entity: 'light.desk' });
		expect(light.querySelector('.fill')).not.toBeNull();
		const { container: cover } = render(EntityTile, { entity: 'cover.blind' });
		expect(cover.querySelector('[data-id="cover.blind"]')).not.toBeNull();
	});

	it('words contact sensors as open and closed, not on and off', () => {
		states.set({
			'binary_sensor.front_door': hassEntity('binary_sensor.front_door', 'off', {
				friendly_name: 'Front Door',
				device_class: 'door'
			}),
			'binary_sensor.living_room_window': hassEntity('binary_sensor.living_room_window', 'on', {
				friendly_name: 'Living Room Window',
				device_class: 'window'
			})
		});
		render(EntityTile, { entity: 'binary_sensor.front_door' });
		expect(screen.getByText('Closed')).toBeTruthy();
		render(EntityTile, { entity: 'binary_sensor.living_room_window' });
		expect(screen.getByText('Open')).toBeTruthy();
	});

	it('leaves other binary sensors on their own wording', () => {
		states.set({
			'binary_sensor.doorbell_motion': hassEntity('binary_sensor.doorbell_motion', 'on', {
				friendly_name: 'Doorbell Motion',
				device_class: 'motion'
			})
		});
		render(EntityTile, { entity: 'binary_sensor.doorbell_motion' });
		expect(screen.getByText('On')).toBeTruthy();
	});
});
