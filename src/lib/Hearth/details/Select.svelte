<script lang="ts">
	import { entityState } from '$lib/core/ha/entities';
	import { callEntityService } from '$lib/core/ha/commands';
	import { pressFeedback } from '../pressFeedback';

	let { entity }: { entity: string } = $props();

	let selectedEntity = $derived(entityState(entity));
	let stateObj = $derived($selectedEntity);
	let domain = $derived(entity.split('.')[0]);
	let options = $derived<string[]>(
		Array.isArray(stateObj?.attributes?.options) ? stateObj.attributes.options : []
	);
</script>

<div class="segments">
	{#each options as option (option)}
		<button
			type="button"
			class="segment"
			use:pressFeedback={entity}
			class:active={stateObj?.state === option}
			onclick={() => callEntityService(domain, 'select_option', entity, { option })}
		>
			{option}
		</button>
	{/each}
</div>
