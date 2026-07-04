<script lang="ts">
	import { Crown, Eye, PartyPopper, Undo2 } from '@lucide/svelte';
	import HouseSwitcher from '$lib/components/HouseSwitcher.svelte';
	import TaskItem from '$lib/components/TaskItem.svelte';

	let { data } = $props();

	const otherHouse = $derived(
		data.households.find((h) => h.id !== data.household.id)
	);
	const leaderId = $derived.by(() => {
		const entries = Object.entries(data.score.byUser);
		if (entries.length === 0) return null;
		const max = Math.max(...entries.map(([, p]) => p));
		const leaders = entries.filter(([, p]) => p === max);
		return leaders.length === 1 ? Number(leaders[0][0]) : null;
	});

	const sectionDefs = $derived(
		[
			{ title: 'Overdue', tasks: data.sections.overdue },
			{ title: 'Today', tasks: data.sections.today },
			{ title: 'Coming up', tasks: data.sections.upcoming },
			{ title: 'Anytime', tasks: data.sections.anytime }
		].filter((s) => s.tasks.length > 0)
	);

	const allClear = $derived(
		data.sections.overdue.length === 0 && data.sections.today.length === 0
	);
</script>

<svelte:head><title>Today · Home</title></svelte:head>

<header class="mb-4 flex items-center justify-between gap-2">
	<h1 class="text-xl font-bold">
		{data.household.emoji}
		{data.household.name}
	</h1>
	<HouseSwitcher households={data.households} currentHouseholdId={data.user?.currentHouseholdId ?? null} />
</header>

{#if data.viewingOther}
	<div class="mb-4 flex items-center gap-2 rounded-2xl bg-sky-50 p-3 text-sm text-sky-800">
		<Eye size={16} class="shrink-0" />
		Peeking at {data.household.name} — you're staying at the other house.
		<a href="/" class="ml-auto shrink-0 font-semibold underline">Back</a>
	</div>
{/if}

<!-- Weekly head-to-head -->
<section class="mb-6 rounded-2xl bg-white p-4 shadow-sm">
	<div class="mb-2 flex items-baseline justify-between">
		<h2 class="text-sm font-semibold text-stone-500">This week</h2>
		<span class="text-xs text-stone-400">Team total: {data.score.team}</span>
	</div>
	<div class="flex justify-around">
		{#each data.allUsers as u (u.id)}
			<div class="flex flex-col items-center">
				<div class="relative text-3xl">
					{u.emoji}
					{#if leaderId === u.id}
						<Crown size={16} class="absolute -top-2 -right-2 rotate-12 text-amber-400" />
					{/if}
				</div>
				<div class="text-sm font-medium">{u.displayName}</div>
				<div class="text-lg font-bold text-accent-600">{data.score.byUser[u.id] ?? 0}</div>
			</div>
		{/each}
	</div>
</section>

{#if allClear}
	<div class="mb-6 flex items-center gap-3 rounded-2xl bg-accent-50 p-4 text-accent-700">
		<PartyPopper size={22} class="shrink-0" />
		<div class="text-sm font-medium">All caught up — nothing due today. Enjoy!</div>
	</div>
{/if}

{#each sectionDefs as section (section.title)}
	<section class="mb-6">
		<h2 class="mb-2 text-sm font-semibold text-stone-500">{section.title}</h2>
		<div class="flex flex-col gap-2">
			{#each section.tasks as task (task.id)}
				<TaskItem
					{task}
					today={data.today}
					streak={data.streaks[task.id] ?? 0}
					subtitle={task.areaName}
				/>
			{/each}
		</div>
	</section>
{/each}

{#if otherHouse && !data.viewingOther}
	<a
		href="/?house={otherHouse.id}"
		class="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed
			border-stone-300 p-3 text-sm text-stone-500"
	>
		<Eye size={16} />
		Peek at {otherHouse.emoji} {otherHouse.name}
	</a>
{/if}
