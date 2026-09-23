<script lang="ts">
	import { timer } from '$lib/core/app/clock';
	import { lang, selectedLanguage } from '$lib/core/i18n';
	import {
		clockTimeOptions,
		hourInTimeZone,
		validTimeZone,
		type ClockHourFormat
	} from '../../clock';

	let {
		timezone,
		hour_format = 'auto',
		show_seconds = false,
		compact = false
	}: {
		timezone?: string;
		hour_format?: ClockHourFormat;
		show_seconds?: boolean;
		/** one line for the narrow-layout status strip: time and a short date */
		compact?: boolean;
	} = $props();

	let now = $derived($timer);

	let activeTimezone = $derived(validTimeZone(timezone));
	let time = $derived(
		now.toLocaleTimeString(
			$selectedLanguage,
			clockTimeOptions(activeTimezone, hour_format, show_seconds)
		)
	);
	let date = $derived(
		now.toLocaleDateString($selectedLanguage, {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			...(activeTimezone ? { timeZone: activeTimezone } : {})
		})
	);
	let shortDate = $derived(
		now.toLocaleDateString($selectedLanguage, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			...(activeTimezone ? { timeZone: activeTimezone } : {})
		})
	);
	let hour = $derived(hourInTimeZone(now, $selectedLanguage, activeTimezone));
	let greeting = $derived(
		$lang(
			hour < 12
				? 'hearth_good_morning'
				: hour < 18
					? 'hearth_good_afternoon'
					: 'hearth_good_evening'
		)
	);
</script>

{#if compact}
	<div class="compact">
		<span class="compact-time">{time}</span>
		<span class="compact-date">{shortDate}</span>
	</div>
{:else}
	<div>
		<div class="clock">{time}</div>
		<div class="date">{date}</div>
		<div class="greeting">{greeting}</div>
	</div>
{/if}

<style>
	.compact {
		display: flex;
		align-items: baseline;
		gap: 10px;
		white-space: nowrap;
	}

	.compact-time {
		font-size: var(--h-type-title);
		font-weight: 600;
		color: var(--h-text-1);
	}

	.compact-date {
		font-size: var(--h-type-secondary);
		color: var(--h-text-4);
	}

	.clock {
		font-size: var(--h-type-clock);
		font-weight: 600;
		line-height: 0.9;
		letter-spacing: -3px;
		color: var(--h-text-1);
	}

	.date {
		font-size: var(--h-type-emphasis);
		color: var(--h-text-4);
		margin-top: 10px;
		letter-spacing: 0.2px;
	}

	.greeting {
		font-size: var(--h-type-body);
		color: var(--h-text-5);
		margin-top: 2px;
	}
	@media (max-width: 900px) {
		.clock {
			font-size: var(--h-type-hero);
		}
	}
</style>
