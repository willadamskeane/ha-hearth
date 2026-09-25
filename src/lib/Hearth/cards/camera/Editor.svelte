<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { ICON } from '../../iconSizes';
	import { activateOnKeyboard } from '../../interaction';
	import { cameraEntities } from '../../model/cards/camera';
	import type { CardEditorProps } from '../types';
	import type { CameraCard } from './descriptor';
	import EntityField from '../../edit/EntityField.svelte';
	import Icon from '../../Icon.svelte';
	import TextField from '../../edit/TextField.svelte';

	let { initial: initialProp, onchange }: CardEditorProps<CameraCard> = $props();

	// remounted per target and type, so the initial value is all the form needs
	// svelte-ignore state_referenced_locally
	const initial = initialProp;

	let title = $state(initial?.title ?? '');
	let cameras = $state<{ entity: string }[]>(
		(initial ? cameraEntities(initial) : []).map((entity) => ({ entity }))
	);
	if (cameras.length === 0) cameras.push({ entity: '' });
	let stream = $state(initial?.stream ?? false);

	$effect(() => {
		const chosen = cameras.map((row) => row.entity.trim()).filter(Boolean);
		// one camera keeps the single-camera form; several make a snapshot grid
		onchange({
			fields: {
				title: title.trim() || undefined,
				entity: chosen.length === 1 ? chosen[0] : undefined,
				entities: chosen.length > 1 ? chosen : undefined,
				stream: stream || undefined
			}
		});
	});
</script>

<TextField
	label={$lang('hearth_title')}
	bind:value={title}
	placeholder={$lang('hearth_example_camera_title')}
/>
{#each cameras as row, index (index)}
	<div class="filter-row">
		<div class="filter-fields">
			<EntityField label={$lang('entity')} bind:value={row.entity} domains={['camera']} />
		</div>
		{#if cameras.length > 1}
			<span
				class="remove"
				role="button"
				tabindex="0"
				onclick={() => cameras.splice(index, 1)}
				onkeydown={(event) => activateOnKeyboard(event, () => cameras.splice(index, 1))}
			>
				<Icon name="delete" size={ICON.control} />
			</span>
		{/if}
	</div>
{/each}
<div
	class="add-filter"
	role="button"
	tabindex="0"
	onclick={() => cameras.push({ entity: '' })}
	onkeydown={(event) => activateOnKeyboard(event, () => cameras.push({ entity: '' }))}
>
	<Icon name="add" size={ICON.control} />
	<span>{$lang('hearth_add_camera')}</span>
</div>
{#if cameras.length <= 1}
	<label class="check">
		<input type="checkbox" bind:checked={stream} />
		<span>{$lang('hearth_live_stream')}</span>
	</label>
{/if}
