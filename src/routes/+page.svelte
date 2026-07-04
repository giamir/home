<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import {
		Check,
		ChevronRight,
		Eye,
		HandHeart,
		PartyPopper,
		Undo2
	} from '@lucide/svelte';
	import HouseSwitcher from '$lib/components/HouseSwitcher.svelte';
	import TaskItem from '$lib/components/TaskItem.svelte';
	import { daysBetween } from '$lib/dates';

	let { data } = $props();

	const me = $derived(data.user!);
	const partner = $derived(data.allUsers.find((u) => u.id !== me.id));
	const otherHouse = $derived(data.households.find((h) => h.id !== data.household.id));

	const greeting = $derived(
		data.hour < 5 ? 'Up late' : data.hour < 12 ? 'Good morning' : data.hour < 18 ? 'Good afternoon' : 'Good evening'
	);

	const dueNow = $derived(
		data.tasks.filter((t) => t.nextDueDate !== null && t.nextDueDate <= data.today)
	);
	const mine = $derived(dueNow.filter((t) => t.responsibleId === me.id));
	const shared = $derived(dueNow.filter((t) => t.responsibleId === null));
	const partners = $derived(dueNow.filter((t) => partner && t.responsibleId === partner.id));
	const upcoming = $derived(
		data.tasks.filter((t) => {
			if (t.nextDueDate === null) return false;
			const d = daysBetween(data.today, t.nextDueDate);
			return d >= 1 && d <= 7;
		})
	);
	const anytime = $derived(data.tasks.filter((t) => t.nextDueDate === null));

	// The one thing to suggest first: your overdue > yours today > shared > cover
	const hero = $derived.by(() => {
		const pick = (list: typeof mine) =>
			[...list].sort((a, b) => (a.nextDueDate! < b.nextDueDate! ? -1 : 1))[0];
		if (mine.length > 0) return { task: pick(mine), kicker: 'Next up for you' };
		if (shared.length > 0) return { task: pick(shared), kicker: '🤝 Up for grabs — make it yours' };
		if (partner && partners.length > 0)
			return { task: pick(partners), kicker: `💚 Cover for ${partner.displayName}` };
		return null;
	});

	const heroDue = $derived.by(() => {
		if (!hero?.task.nextDueDate) return '';
		const diff = daysBetween(data.today, hero.task.nextDueDate);
		return diff < 0 ? `${-diff} day${diff === -1 ? '' : 's'} overdue` : 'due today';
	});

	// Remaining lists, with the hero task taken out
	const minusHero = (list: typeof mine) => list.filter((t) => t.id !== hero?.task.id);

	const myPoints = $derived(data.score.byUser[me.id] ?? 0);
	const partnerPoints = $derived(partner ? (data.score.byUser[partner.id] ?? 0) : 0);
	const myDoneToday = $derived(data.doneToday[me.id] ?? 0);
	const overdueMine = $derived(mine.filter((t) => t.nextDueDate! < data.today).length);
	const bestStreak = $derived(Math.max(0, ...mine.map((t) => data.streaks[t.id] ?? 0)));

	const encouragement = $derived.by(() => {
		const name = partner?.displayName ?? 'your partner';
		if (mine.length === 0 && shared.length === 0) {
			return myDoneToday > 0
				? `Everything on your side is done — ${myDoneToday} chore${myDoneToday === 1 ? '' : 's'} today. Enjoy! 🎉`
				: 'Nothing on your plate right now ✨';
		}
		if (overdueMine > 0) return 'A quick win is waiting for you 💪';
		if (myDoneToday > 0) return `${myDoneToday} down already — nice momentum 🔥`;
		if (bestStreak > 1) return `You're protecting a ${bestStreak}-streak today 🔥`;
		if (myPoints > partnerPoints && partnerPoints > 0)
			return `You're leading ${myPoints}–${partnerPoints} this week 👑`;
		if (partnerPoints > myPoints) return `${name} is ahead ${partnerPoints}–${myPoints} 😏`;
		return 'One small chore sets the tone for the day ✨';
	});

	let heroCompleting = $state(false);
</script>

{#snippet taskSection(title: string, tasks: typeof mine, open: boolean, hint: Snippet | null)}
	{#if tasks.length > 0}
		<details class="mb-3 rounded-2xl bg-white shadow-sm" {open}>
			<summary
				class="flex cursor-pointer list-none items-center gap-2 p-4 font-medium select-none"
			>
				<span class="flex-1">{title}</span>
				{#if hint}{@render hint()}{/if}
				<span
					class="flex size-6 shrink-0 items-center justify-center rounded-full bg-stone-100
						text-xs font-semibold text-stone-600"
				>
					{tasks.length}
				</span>
				<ChevronRight size={16} class="shrink-0 text-stone-500 transition-transform" />
			</summary>
			<div class="flex flex-col gap-2 p-3 pt-0">
				{#each tasks as task (task.id)}
					<TaskItem {task} today={data.today} streak={data.streaks[task.id] ?? 0} subtitle={task.areaName} />
				{/each}
			</div>
		</details>
	{/if}
{/snippet}

<svelte:head><title>Today · Home</title></svelte:head>

<header class="mb-2 flex items-center justify-between gap-2">
	<h1 class="text-xl font-bold">{greeting}, {me.displayName} {me.emoji}</h1>
	<HouseSwitcher households={data.households} currentHouseholdId={me.currentHouseholdId ?? null} />
</header>

<p class="mb-5 text-base text-stone-600">{encouragement}</p>

{#if data.viewingOther}
	<div class="mb-4 flex items-center gap-2 rounded-2xl bg-sky-50 p-3 text-sm text-sky-800">
		<Eye size={16} class="shrink-0" />
		Peeking at {data.household.name} — you're staying at the other house.
		<a href="/" class="ml-auto shrink-0 font-semibold underline">Back</a>
	</div>
{/if}

<!-- The one suggested action -->
{#if hero}
	<section
		class="mb-4 rounded-2xl border-2 border-accent-200 bg-white p-4 shadow-sm
			{heroCompleting ? 'opacity-40' : ''}"
	>
		<div class="text-xs font-semibold tracking-wide text-accent-700 uppercase">
			{hero.kicker}
		</div>
		<h2 class="mt-1 text-lg font-bold">{hero.task.title}</h2>
		<p class="mt-0.5 text-sm text-stone-500">
			{hero.task.areaName} · {heroDue}
			{#if (data.streaks[hero.task.id] ?? 0) > 1}
				· 🔥 {data.streaks[hero.task.id]}-streak
			{/if}
		</p>
		<form
			method="post"
			action="?/complete"
			class="mt-3"
			use:enhance={() => {
				heroCompleting = true;
				return async ({ update }) => {
					await update();
					heroCompleting = false;
				};
			}}
		>
			<input type="hidden" name="taskId" value={hero.task.id} />
			<button
				disabled={heroCompleting}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 py-3
					text-base font-semibold text-white disabled:opacity-50"
			>
				<Check size={18} strokeWidth={3} />
				Mark done · +{hero.task.points}
			</button>
		</form>
	</section>
{:else}
	<section class="mb-4 flex items-center gap-3 rounded-2xl bg-accent-50 p-4 text-accent-700">
		<PartyPopper size={24} class="shrink-0" />
		<div>
			<div class="font-semibold">All caught up at {data.household.name}!</div>
			<div class="text-sm">Nothing needs you right now.</div>
		</div>
	</section>
{/if}

<!-- Compact week strip -->
<a
	href="/stats"
	class="mb-5 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
>
	<span class="font-medium text-stone-600">This week</span>
	<span class="flex-1 text-center font-semibold">
		{#each data.allUsers as u, i (u.id)}
			{#if i > 0}<span class="mx-1 font-normal text-stone-400">·</span>{/if}
			{u.emoji} {data.score.byUser[u.id] ?? 0}
		{/each}
	</span>
	<span class="text-stone-500">team {data.score.team}</span>
	<ChevronRight size={16} class="text-stone-500" />
</a>

{@render taskSection('Yours today', minusHero(mine), true, null)}
{@render taskSection('🤝 Up for grabs', minusHero(shared), false, null)}
{#if partner}
	{@render taskSection(`${partner.emoji} On ${partner.displayName}'s plate`, minusHero(partners), false, heartHint)}
{/if}
{@render taskSection('Coming up', upcoming, false, null)}
{@render taskSection('Anytime', anytime, false, null)}

{#snippet heartHint()}
	<HandHeart size={15} class="shrink-0 text-pink-600" />
{/snippet}

<!-- Done today -->
{#if data.doneTodayList.length > 0}
	<details class="mb-3 rounded-2xl bg-white shadow-sm" open>
		<summary class="flex cursor-pointer list-none items-center gap-2 p-4 font-medium select-none">
			<span class="flex-1">Done today 🎉</span>
			<span
				class="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-50
					text-xs font-semibold text-accent-700"
			>
				{data.doneTodayList.length}
			</span>
			<ChevronRight size={16} class="shrink-0 text-stone-500" />
		</summary>
		<div class="flex flex-col gap-2 p-3 pt-0">
			{#each data.doneTodayList as completion (completion.id)}
				{@const doer = data.allUsers.find((u) => u.id === completion.userId)}
				<div class="flex items-center gap-3 rounded-2xl bg-stone-50 p-3">
					<span class="text-xl">{doer?.emoji}</span>
					<div class="min-w-0 flex-1">
						<div class="truncate font-medium text-stone-500 line-through">
							{completion.taskTitle}
							{#if completion.coveredForUserId}
								<HandHeart size={14} class="inline text-pink-600" />
							{/if}
						</div>
						<div class="text-xs text-stone-500">
							{new Date(completion.completedAt).toLocaleTimeString('en-GB', {
								hour: '2-digit',
								minute: '2-digit'
							})} · +{completion.pointsAwarded}
						</div>
					</div>
					<form method="post" action="?/uncomplete" use:enhance>
						<input type="hidden" name="completionId" value={completion.id} />
						<button
							aria-label="Undo {completion.taskTitle}"
							class="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
						>
							<Undo2 size={16} /> Undo
						</button>
					</form>
				</div>
			{/each}
		</div>
	</details>
{/if}

{#if otherHouse && !data.viewingOther}
	<a
		href="/?house={otherHouse.id}"
		class="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed
			border-stone-400 p-3 text-sm text-stone-500"
	>
		<Eye size={16} />
		Peek at {otherHouse.emoji} {otherHouse.name}
	</a>
{/if}
