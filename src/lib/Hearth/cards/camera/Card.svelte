<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import CameraPlayer from '../../CameraPlayer.svelte';
	import EmptyState from '../../EmptyState.svelte';
	import type { OverviewCard } from '../../config';
	import { cameraEntities } from '../../model/cards/camera';
	import CameraThumb from './CameraThumb.svelte';

	let { card }: { card: Extract<OverviewCard, { type: 'camera' }> } = $props();
	let cameras = $derived(cameraEntities(card));
</script>

<div class="section">
	{#if card.title}
		<div class="section-title">{card.title}</div>
	{/if}
	{#if cameras.length > 1}
		<div class="grid">
			{#each cameras as entity (entity)}
				<CameraThumb {entity} />
			{/each}
		</div>
	{:else if cameras.length === 1}
		<div class="camera">
			<CameraPlayer entity={cameras[0]} stream={card.stream} />
		</div>
	{:else}
		<EmptyState text={$lang('hearth_pick_a_camera_entity_in_the')} />
	{/if}
</div>

<style>
	.section-title {
		font-size: var(--h-type-title);
		font-weight: 600;
		color: var(--h-text-2);
		margin-bottom: 14px;
	}

	.camera {
		border-radius: var(--h-radius-card);
		overflow: hidden;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		backdrop-filter: var(--h-surface-blur);
		box-shadow: var(--h-card-shadow);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
</style>
