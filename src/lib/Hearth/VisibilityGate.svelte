<script lang="ts">
	import type { Snippet } from 'svelte';
	import { entityStates } from '$lib/core/ha/entities';
	import type { VisibilityCondition } from './config';
	import { evaluateVisibility, visibilityEntityIds } from './visibility';

	let {
		conditions,
		children
	}: { conditions?: VisibilityCondition[]; children: Snippet<[boolean]> } = $props();

	let mediaMatches = $state<Record<string, boolean>>({});
	let selectedStates = $derived(entityStates(visibilityEntityIds(conditions)));

	// (re)subscribes to just the media queries this item's conditions use,
	// tearing down the previous set's listeners whenever conditions change
	$effect(() => {
		const queries = (conditions ?? [])
			.filter((condition): condition is { media: string } => 'media' in condition)
			.map((condition) => condition.media);

		if (queries.length === 0) {
			// no write when there is nothing to clear: every card mounts this
			if (Object.keys(mediaMatches).length) mediaMatches = {};
			return;
		}

		const entries = queries.flatMap((query) => {
			let mql: MediaQueryList;
			try {
				mql = window.matchMedia(query);
			} catch {
				// user-entered queries can be malformed css; treat as non-matching
				return [];
			}
			const listener = () => {
				mediaMatches = { ...mediaMatches, [query]: mql.matches };
			};
			mql.addEventListener('change', listener);
			return [{ query, mql, listener }];
		});

		mediaMatches = Object.fromEntries(entries.map(({ query, mql }) => [query, mql.matches]));

		return () => {
			for (const { mql, listener } of entries) mql.removeEventListener('change', listener);
		};
	});

	let visible = $derived(evaluateVisibility(conditions, $selectedStates, mediaMatches));
</script>

{@render children(visible)}
