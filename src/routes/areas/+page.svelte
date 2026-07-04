<script lang="ts">
	import { enhance } from '$app/forms';
	import { ChevronRight, Plus } from '@lucide/svelte';
	import HouseSwitcher from '$lib/components/HouseSwitcher.svelte';
	import IconPicker from '$lib/components/IconPicker.svelte';
	import OwnerSelect from '$lib/components/OwnerSelect.svelte';
	import { areaIcon } from '$lib/icons';

	let { data, form } = $props();

	const groups = $derived.by(() => {
		const byOwner = (ownerId: number | null) =>
			data.areas.filter((a) => a.ownerUserId === ownerId);
		return [
			...data.allUsers.map((u) => ({
				title: `${u.emoji} ${u.displayName}'s`,
				areas: byOwner(u.id)
			})),
			{ title: '🤝 Shared', areas: byOwner(null) }
		].filter((g) => g.areas.length > 0);
	});

	let newIcon = $state('house');
	let newOwner = $state('');
</script>

<svelte:head><title>Areas · Home</title></svelte:head>

<header class="mb-4 flex items-center justify-between gap-2">
	<h1 class="text-xl font-bold">Areas</h1>
	<HouseSwitcher
		households={data.households}
		currentHouseholdId={data.user?.currentHouseholdId ?? null}
	/>
</header>

{#each groups as group (group.title)}
	<section class="mb-5">
		<h2 class="mb-2 text-sm font-semibold text-stone-500">{group.title}</h2>
		<div class="flex flex-col gap-2">
			{#each group.areas as area (area.id)}
				{@const Icon = areaIcon(area.icon)}
				<a
					href="/areas/{area.id}"
					class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
				>
					<div class="flex size-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
						<Icon size={20} />
					</div>
					<span class="flex-1 font-medium">{area.name}</span>
					{#if data.dueCounts[area.id]}
						<span
							class="flex size-6 items-center justify-center rounded-full bg-amber-100
								text-xs font-bold text-amber-700"
						>
							{data.dueCounts[area.id]}
						</span>
					{/if}
					<ChevronRight size={18} class="text-stone-500" />
				</a>
			{/each}
		</div>
	</section>
{/each}

<details class="mb-4 rounded-2xl border border-dashed border-stone-400">
	<summary
		class="flex cursor-pointer list-none items-center justify-center gap-2 p-3 text-sm
			font-medium text-stone-500"
	>
		<Plus size={16} />
		New area in {data.household.emoji} {data.household.name}
	</summary>
	<form method="post" action="?/create" use:enhance class="flex flex-col gap-3 p-3 pt-0">
		<input type="hidden" name="householdId" value={data.household.id} />
		<input
			type="text"
			name="name"
			placeholder="Area name"
			required
			class="rounded-xl border-2 border-stone-200 px-3 py-2 focus:border-accent-500 focus:outline-none"
		/>
		<IconPicker bind:selected={newIcon} />
		<OwnerSelect users={data.allUsers} bind:selected={newOwner} />
		{#if form?.message}
			<p class="text-sm text-red-600">{form.message}</p>
		{/if}
		<button class="rounded-xl bg-accent-600 py-2.5 font-semibold text-white">Create area</button>
	</form>
</details>
