<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ICON } from '../iconSizes';
	import Icon from '../Icon.svelte';

	/** One status-strip entry: an icon and a single line of text, optionally tappable. */
	let {
		icon,
		iconColor = 'var(--h-icon)',
		fill = false,
		label = undefined,
		onclick = undefined,
		children
	}: {
		icon: string;
		iconColor?: string;
		fill?: boolean;
		label?: string;
		onclick?: () => void;
		children: Snippet;
	} = $props();
</script>

<svelte:element
	this={onclick ? 'button' : 'div'}
	class="chip"
	class:pressable={onclick}
	type={onclick ? 'button' : undefined}
	role={onclick ? undefined : 'status'}
	title={label}
	aria-label={label}
	{onclick}
>
	<Icon name={icon} size={ICON.inline} color={iconColor} {fill} />
	<span class="text">{@render children()}</span>
</svelte:element>

<style>
	.chip {
		flex: none;
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 32px;
		max-width: 260px;
		padding: 0 12px;
		border: 1px solid rgb(var(--h-line-rgb) / calc(0.08 * var(--h-line-scale)));
		border-radius: var(--h-radius-pill);
		background: rgb(var(--h-surface-rgb) / calc(0.045 * var(--h-fill-scale)));
		color: var(--h-text-3);
		font: inherit;
		font-size: var(--h-type-secondary);
		white-space: nowrap;
	}

	button.chip {
		cursor: pointer;
	}

	.text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
