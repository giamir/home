<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { Household } from '$lib/server/db/schema';

	let {
		households,
		currentHouseholdId
	}: { households: Household[]; currentHouseholdId: number | null } = $props();
</script>

<form method="post" action="/switch" use:enhance class="flex rounded-full bg-stone-200/70 p-1">
	<input type="hidden" name="redirectTo" value={page.url.pathname} />
	{#each households as household (household.id)}
		<button
			name="householdId"
			value={household.id}
			class="rounded-full px-3 py-1 text-sm font-medium transition-colors
				{household.id === currentHouseholdId ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}"
		>
			{household.emoji}
			{household.name}
		</button>
	{/each}
</form>
