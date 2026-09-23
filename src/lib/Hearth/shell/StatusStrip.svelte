<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { ICON } from '../iconSizes';
	import { hasStripWidgets, isStripWidget } from '../widgets';
	import { enterEditMode, hearthConfig, hearthEditMode, hearthLoadError } from '../store';
	import Icon from '../Icon.svelte';
	import RailWidgetRenderer from '../RailWidgetRenderer.svelte';
	import VisibilityGate from '../VisibilityGate.svelte';

	/**
	 * The rail's glanceable widgets (clock, weather, energy, activity, next
	 * event) as one line of chips where the rail folds away, so they sit above
	 * the page instead of a screen below it. Hidden by CSS above the rail-folds
	 * breakpoint and in edit mode, where the full rail stays editable.
	 *
	 * The edit toggle rides at its far end: entering edit mode is rare on a
	 * wall tablet and should not take a slot from the page tabs. PhoneNav keeps
	 * it only when there is no strip.
	 */
	let { hideEditToggle = false }: { hideEditToggle?: boolean } = $props();

	let widgets = $derived(
		$hearthConfig.rail.filter((widget) => isStripWidget(widget) && !widget.hide_mobile)
	);
</script>

{#if hasStripWidgets($hearthConfig.rail) && !$hearthEditMode}
	<div class="status-strip" role="group" aria-label={$lang('hearth_status')}>
		{#each widgets as widget (widget.id)}
			<VisibilityGate conditions={widget.visibility}>
				{#snippet children(visible)}
					{#if visible}
						<RailWidgetRenderer {widget} compact />
					{/if}
				{/snippet}
			</VisibilityGate>
		{/each}
		{#if !hideEditToggle && !$hearthLoadError}
			<button
				type="button"
				class="edit pressable"
				aria-label={$lang('hearth_edit_configuration')}
				onclick={enterEditMode}
			>
				<Icon name="edit" size={ICON.inline} />
			</button>
		{/if}
	</div>
{/if}

<style>
	.status-strip {
		display: none;
	}

	@media (max-width: 900px) {
		.status-strip {
			display: flex;
			align-items: center;
			gap: 8px;
			min-width: 0;
			/* one line: chips that do not fit are clipped rather than wrapping
			   the page down or scrolling it sideways; clip only sideways so the
			   clock's glyphs and the chip borders are never cut vertically */
			overflow-x: clip;
			padding: 8px 2px 0;
			/* the layout's row gap separates page sections; the strip belongs
			   with the page tabs right under it, 8px away */
			margin-bottom: -16px;
		}

		.edit {
			flex: none;
			display: flex;
			align-items: center;
			justify-content: center;
			width: 32px;
			height: 32px;
			padding: 0;
			border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
			border-radius: var(--h-radius-pill);
			background: rgb(var(--h-surface-rgb) / calc(0.045 * var(--h-fill-scale)));
			color: var(--h-text-4);
			cursor: pointer;
		}

		/* the clock leads; everything after it sits on the right */
		.status-strip > :global(:first-child) {
			margin-right: auto;
		}
	}
</style>
