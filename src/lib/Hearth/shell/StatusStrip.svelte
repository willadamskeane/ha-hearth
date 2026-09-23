<script lang="ts">
	import { lang } from '$lib/core/i18n';
	import { isStripWidget } from '../widgets';
	import { hearthConfig, hearthEditMode } from '../store';
	import RailWidgetRenderer from '../RailWidgetRenderer.svelte';
	import VisibilityGate from '../VisibilityGate.svelte';

	/**
	 * The rail's glanceable widgets (clock, weather, energy, activity, next
	 * event) as one line of chips where the rail folds away, so they sit above
	 * the page instead of a screen below it. Hidden by CSS above the rail-folds
	 * breakpoint and in edit mode, where the full rail stays editable.
	 */
	let widgets = $derived(
		$hearthConfig.rail.filter((widget) => isStripWidget(widget) && !widget.hide_mobile)
	);
</script>

{#if widgets.length && !$hearthEditMode}
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
			   the page down or scrolling it sideways */
			overflow: hidden;
			padding: 4px 2px 0;
			/* the layout's row gap separates page sections; the strip belongs
			   with the page tabs right under it, 8px away */
			margin-bottom: -16px;
		}

		/* the clock leads; everything after it sits on the right */
		.status-strip > :global(:first-child) {
			margin-right: auto;
		}
	}
</style>
