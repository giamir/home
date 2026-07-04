<script lang="ts">
	import { ArrowLeft, Flame, HandHeart, Repeat } from '@lucide/svelte';

	let { data } = $props();

	const cadence = $derived(
		data.task.isRecurring
			? `every ${data.task.recurrenceInterval} ${data.task.recurrenceUnit}${(data.task.recurrenceInterval ?? 1) > 1 ? 's' : ''}`
			: 'one-off'
	);

	function dayLabel(localDate: string) {
		if (localDate === data.today) return 'Today';
		const [y, m, d] = localDate.split('-').map(Number);
		return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			timeZone: 'UTC'
		});
	}
</script>

<svelte:head><title>{data.task.title} · Home</title></svelte:head>

<a href="/areas/{data.area.id}" class="mb-3 inline-flex items-center gap-1 text-sm text-stone-500">
	<ArrowLeft size={16} /> {data.area.name}
</a>

<header class="mb-4">
	<h1 class="text-xl font-bold">{data.task.title}</h1>
	<p class="mt-0.5 flex items-center gap-1.5 text-sm text-stone-500">
		{data.household.emoji}
		{data.household.name} · {data.area.name} ·
		{#if data.task.isRecurring}<Repeat size={13} class="inline" />{/if}
		{cadence} · +{data.task.points}
	</p>
</header>

<section class="mb-4 grid grid-cols-3 gap-3 text-center">
	<div class="rounded-2xl bg-white p-3 shadow-sm">
		<div class="text-xl font-bold">{data.history.length}</div>
		<div class="text-xs text-stone-500">times done</div>
	</div>
	<div class="rounded-2xl bg-white p-3 shadow-sm">
		<div class="text-xl font-bold">
			{data.avgIntervalDays === null ? '—' : `${data.avgIntervalDays}d`}
		</div>
		<div class="text-xs text-stone-500">avg. between</div>
	</div>
	<div class="rounded-2xl bg-white p-3 shadow-sm">
		<div class="flex items-center justify-center gap-0.5 text-xl font-bold">
			{#if data.streak > 0}<Flame size={18} class="text-orange-700" />{/if}
			{data.streak}
		</div>
		<div class="text-xs text-stone-500">streak</div>
	</div>
</section>

<section class="mb-4 rounded-2xl bg-white p-4 shadow-sm">
	<h2 class="mb-2 text-sm font-semibold text-stone-500">Who does it</h2>
	{#each data.allUsers as u (u.id)}
		{@const stats = data.byUser[u.id]}
		<div class="flex items-center justify-between py-1 text-sm">
			<span>{u.emoji} {u.displayName}</span>
			<span class="font-semibold">
				{stats?.count ?? 0}× <span class="font-normal text-stone-500">({stats?.points ?? 0} pts)</span>
			</span>
		</div>
	{/each}
</section>

{#if data.history.length > 0}
	<section class="mb-4 rounded-2xl bg-white p-4 shadow-sm">
		<h2 class="mb-2 text-sm font-semibold text-stone-500">History</h2>
		<div class="flex flex-col gap-1.5">
			{#each data.history as completion (completion.id)}
				<div class="flex items-center gap-2 text-sm">
					<span class="w-14 shrink-0 text-xs text-stone-500">{dayLabel(completion.localDate)}</span>
					<span class="shrink-0">{completion.userEmoji}</span>
					<span class="min-w-0 flex-1 truncate">
						{completion.userName}
						{#if completion.coveredForUserId}
							<HandHeart size={13} class="inline text-pink-600" />
						{/if}
					</span>
					<span class="shrink-0 text-xs {completion.onTime ? 'text-accent-700' : 'text-stone-500'}">
						{completion.onTime ? 'on time' : 'late'} · +{completion.pointsAwarded}
					</span>
				</div>
			{/each}
		</div>
	</section>
{:else}
	<p class="rounded-2xl bg-white p-4 text-center text-sm text-stone-500">
		Never done yet — be the first 😏
	</p>
{/if}
