<script lang="ts">
	import { ICON } from './iconSizes';
	import { lang } from '$lib/core/i18n';
	import { activateOnKeyboard } from './interaction';
	import { entityState } from '$lib/core/ha/entities';
	import { hearthEditMode } from './store';
	import { sensorNumber } from '$lib/core/ha/entities';
	import Icon from './Icon.svelte';

	let {
		icon = 'home',
		title = '',
		subtitle = undefined,
		tempEntity = undefined,
		humidityEntity = undefined,
		onedit = undefined
	}: {
		icon?: string;
		title?: string;
		subtitle?: string;
		tempEntity?: string;
		humidityEntity?: string;
		onedit?: () => void;
	} = $props();

	// where the rail folds away (the PhoneNav breakpoint) the header shares a
	// small screen with the cards, so it drops to a compact size
	let narrow = $state(false);
	$effect(() => {
		if (typeof window.matchMedia !== 'function') return;
		const query = window.matchMedia('(max-width: 900px)');
		const update = () => (narrow = query.matches);
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	});

	let selectedTemp = $derived(entityState(tempEntity));
	let selectedHumidity = $derived(entityState(humidityEntity));

	let climate = $derived.by(() => {
		const temp = sensorNumber($selectedTemp?.state);
		const humidity = sensorNumber($selectedHumidity?.state);
		return {
			temp: temp === null ? '-' : `${temp.toFixed(1)}°`,
			humidity: humidity === null ? '-' : `${Math.round(humidity)}%`
		};
	});
</script>

<div
	class="header"
	class:editable={$hearthEditMode && onedit}
	onclick={() => $hearthEditMode && onedit?.()}
	role="button"
	tabindex="0"
	onkeydown={(event) => activateOnKeyboard(event, () => $hearthEditMode && onedit?.())}
>
	<div class="icon-tile">
		<Icon
			name={icon || 'home'}
			size={narrow ? ICON.tile : ICON.hero}
			color="var(--h-accent-text)"
		/>
	</div>
	<div class="titles">
		<div class="name">{title}</div>
		<div class="summary">{subtitle ?? ''}</div>
	</div>
	{#if $hearthEditMode && onedit}
		<div class="edit-hint">
			<Icon name="edit" size={ICON.control} />
		</div>
	{/if}
	<div class="chips">
		{#if tempEntity}
			<div class="chip">
				<div class="chip-value">{climate.temp}</div>
				<div class="chip-label">{$lang('hearth_temp')}</div>
			</div>
		{/if}
		{#if humidityEntity}
			<div class="chip">
				<div class="chip-value">{climate.humidity}</div>
				<div class="chip-label">{$lang('hearth_humidity')}</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.header {
		display: flex;
		align-items: center;
		/* the stat chips drop under the title before the title wraps per word */
		flex-wrap: wrap;
		gap: 18px;
	}

	.header.editable {
		cursor: pointer;
	}

	.edit-hint {
		color: var(--h-icon);
	}

	.icon-tile {
		width: 64px;
		height: 64px;
		border-radius: var(--h-radius-md);
		background: rgb(var(--h-accent-rgb) / calc(0.14 * var(--h-accent-scale)));
		border: 1px solid rgb(var(--h-accent-rgb) / calc(0.22 * var(--h-accent-scale)));
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}

	.titles {
		flex: 1 1 180px;
		min-width: 0;
	}

	.name {
		font-size: var(--h-type-display-sm);
		font-weight: 600;
		color: var(--h-text-1);
		letter-spacing: -0.5px;
	}

	.summary {
		font-size: var(--h-type-body);
		color: var(--h-text-5);
	}

	.chips {
		display: flex;
		gap: 12px;
	}

	.chip {
		height: 64px;
		padding: 0 18px;
		border-radius: var(--h-radius-sm);
		background: rgb(var(--h-surface-rgb) / calc(0.05 * var(--h-fill-scale)));
		backdrop-filter: var(--h-surface-blur);
		box-shadow: var(--h-card-shadow);
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.07 * var(--h-line-scale)));
		display: flex;
		flex-direction: column;
		justify-content: center;
		text-align: center;
	}

	.chip-value {
		font-size: var(--h-type-headline);
		font-weight: 600;
		color: var(--h-text-1);
	}

	.chip-label {
		font-size: var(--h-type-small);
		color: var(--h-text-5);
	}

	@media (max-width: 900px) {
		.header {
			gap: 12px;
		}

		.icon-tile {
			width: 40px;
			height: 40px;
			border-radius: var(--h-radius-sm);
		}

		.name {
			font-size: var(--h-type-title);
			letter-spacing: 0;
		}

		.chips {
			gap: 8px;
		}

		.chip {
			height: 40px;
			padding: 0 12px;
		}

		.chip-value {
			font-size: var(--h-type-emphasis);
		}

		.chip-label {
			font-size: var(--h-type-caption);
		}
	}
</style>
