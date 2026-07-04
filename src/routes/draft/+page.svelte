<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, PartyPopper, RotateCcw } from '@lucide/svelte';

	let { data } = $props();

	const unpicked = $derived(data.pool.filter((t) => t.assignedUserId === null));
	const picksFor = (userId: number) => data.pool.filter((t) => t.assignedUserId === userId);
	const minutesFor = (userId: number) =>
		picksFor(userId).reduce((s, t) => s + t.estimatedMinutes, 0);

	// Snake order (A B B A A B…) derived from how many picks have been made, so
	// a reload never loses the turn. First picker alternates fairly over rounds.
	const pickCount = $derived(data.pool.length - unpicked.length);
	const currentPicker = $derived.by(() => {
		const [a, b] = data.allUsers;
		if (!a || !b) return null;
		const round = Math.floor(pickCount / 2);
		const posInRound = pickCount % 2;
		const first = round % 2 === 0 ? a : b;
		const second = round % 2 === 0 ? b : a;
		return posInRound === 0 ? first : second;
	});

	function hours(minutes: number) {
		if (minutes < 60) return `${minutes}m`;
		return `${Math.floor(minutes / 60)}h${minutes % 60 ? String(minutes % 60).padStart(2, '0') : ''}`;
	}
</script>

<svelte:head><title>Draft · Home</title></svelte:head>

<a href="/review" class="mb-3 inline-flex items-center gap-1 text-sm text-stone-500">
	<ArrowLeft size={16} /> Review
</a>

<h1 class="mb-1 text-xl font-bold">🏈 Chore draft</h1>
<p class="mb-5 text-base text-stone-600">
	Take turns picking this week's chores at {data.household.emoji}
	{data.household.name}. Big ones first — snake order keeps it fair.
</p>

<!-- Rosters -->
<section class="mb-5 grid grid-cols-2 gap-3">
	{#each data.allUsers as u (u.id)}
		<div
			class="rounded-2xl bg-white p-3 shadow-sm
				{currentPicker?.id === u.id && unpicked.length > 0 ? 'ring-2 ring-accent-500' : ''}"
		>
			<div class="mb-1 flex items-baseline justify-between">
				<span class="font-semibold">{u.emoji} {u.displayName}</span>
				<span class="text-xs text-stone-500">{hours(minutesFor(u.id))}</span>
			</div>
			{#each picksFor(u.id) as task (task.id)}
				<div class="truncate text-sm text-stone-600">· {task.title}</div>
			{:else}
				<div class="text-sm text-stone-400">no picks yet</div>
			{/each}
		</div>
	{/each}
</section>

{#if unpicked.length > 0 && currentPicker}
	<h2 class="mb-2 text-sm font-semibold text-stone-500">
		{currentPicker.emoji}
		{currentPicker.displayName}'s pick — tap a chore
	</h2>
	<div class="mb-5 flex flex-col gap-2">
		{#each unpicked as task (task.id)}
			<form method="post" action="?/pick" use:enhance>
				<input type="hidden" name="taskId" value={task.id} />
				<input type="hidden" name="userId" value={currentPicker.id} />
				<button
					class="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm
						hover:ring-2 hover:ring-accent-200"
				>
					<div class="min-w-0 flex-1">
						<div class="truncate font-medium">
							{task.title}
							{#if task.dread}😖{/if}
						</div>
						<div class="text-xs text-stone-500">{task.areaName}</div>
					</div>
					<div class="shrink-0 text-right text-xs text-stone-500">
						{hours(task.estimatedMinutes)}<br />+{task.points}
					</div>
				</button>
			</form>
		{/each}
	</div>
{:else if data.pool.length > 0}
	<div class="mb-5 flex items-center gap-3 rounded-2xl bg-accent-50 p-4 text-accent-700">
		<PartyPopper size={22} class="shrink-0" />
		<div class="text-sm font-medium">
			Draft complete! The week is split — may the odds be ever in your favour.
		</div>
	</div>
{:else}
	<p class="mb-5 rounded-2xl bg-white p-4 text-center text-sm text-stone-500">
		Nothing due in the next 7 days to draft.
	</p>
{/if}

{#if data.pool.length > 0}
	<form method="post" action="?/reset" use:enhance>
		<button
			class="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed
				border-stone-400 p-3 text-sm text-stone-500"
		>
			<RotateCcw size={15} /> Start over (unassign everything)
		</button>
	</form>
{/if}
