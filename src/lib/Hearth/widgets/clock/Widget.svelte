<script lang="ts">
	import type { ClockWidget } from './descriptor';
	import Clock from './Clock.svelte';

	let { widget, compact = false }: { widget: ClockWidget; compact?: boolean } = $props();
</script>

<Clock
	timezone={widget.timezone}
	hour_format={widget.hour_format}
	show_seconds={widget.show_seconds}
	{compact}
/>
