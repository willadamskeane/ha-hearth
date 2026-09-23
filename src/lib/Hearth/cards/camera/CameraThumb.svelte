<script lang="ts">
	import { entityState } from '$lib/core/ha/entities';
	import CameraPlayer from '../../CameraPlayer.svelte';
	import { openEntityDetail } from '../../details';
	import { hearthEditMode } from '../../store';

	let { entity }: { entity: string } = $props();

	let stateObj = $derived(entityState(entity));
	let label = $derived(($stateObj?.attributes?.friendly_name as string | undefined) ?? entity);
</script>

<!-- a snapshot that opens the live view -->
<button
	type="button"
	class="thumb"
	aria-label={label}
	disabled={$hearthEditMode}
	onclick={() => !$hearthEditMode && openEntityDetail(entity, label)}
>
	<CameraPlayer {entity} />
	<span class="name">{label}</span>
</button>

<style>
	.thumb {
		position: relative;
		display: block;
		width: 100%;
		padding: 0;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.06 * var(--h-line-scale)));
		border-radius: var(--h-radius-md);
		overflow: hidden;
		background: none;
		font: inherit;
		cursor: pointer;
	}

	.thumb:disabled {
		cursor: default;
	}

	.name {
		position: absolute;
		left: 8px;
		bottom: 8px;
		max-width: calc(100% - 16px);
		padding: 2px 8px;
		border-radius: var(--h-radius-xs);
		background: var(--h-sheet-0);
		color: var(--h-text-1);
		font-size: var(--h-type-small);
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
