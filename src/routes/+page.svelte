<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import {
		AlarmClockOff,
		Check,
		ChevronRight,
		ClipboardCheck,
		Eye,
		HandHeart,
		Handshake,
		PartyPopper,
		Plus,
		Trophy,
		Undo2
	} from '@lucide/svelte';
	import HouseSwitcher from '$lib/components/HouseSwitcher.svelte';
	import TaskItem from '$lib/components/TaskItem.svelte';
	import ReactionBar from '$lib/components/ReactionBar.svelte';
	import Confetti from '$lib/components/Confetti.svelte';
	import { daysBetween } from '$lib/dates';

	let { data, form } = $props();

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
			return d >= 1 && d <= 14;
		})
	);
	const anytime = $derived(data.tasks.filter((t) => t.nextDueDate === null));

	// Agenda: coming up, grouped by day
	const upcomingGroups = $derived.by(() => {
		const groups: { date: string; label: string; tasks: typeof upcoming }[] = [];
		for (const task of upcoming) {
			let group = groups.find((g) => g.date === task.nextDueDate);
			if (!group) {
				const diff = daysBetween(data.today, task.nextDueDate!);
				const [y, m, d] = task.nextDueDate!.split('-').map(Number);
				const label =
					diff === 1
						? 'Tomorrow'
						: new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
								weekday: 'long',
								day: 'numeric',
								month: 'short',
								timeZone: 'UTC'
							});
				group = { date: task.nextDueDate!, label, tasks: [] };
				groups.push(group);
			}
			group.tasks.push(task);
		}
		return groups.sort((a, b) => (a.date < b.date ? -1 : 1));
	});

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

	const minusHero = (list: typeof mine) => list.filter((t) => t.id !== hero?.task.id);

	const overdueCount = $derived(dueNow.filter((t) => t.nextDueDate! < data.today).length);

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

	let heroBusy = $state(false);
	let confettiBurst = $state(0);
	let levelUp = $state<{ level: number; title: string } | null>(null);

	$effect(() => {
		if (form?.completed) {
			untrack(() => {
				confettiBurst++;
				if (form.leveledUp && form.newLevel && form.newLevelTitle) {
					levelUp = { level: form.newLevel, title: form.newLevelTitle };
				}
			});
		}
	});

	const heroEnhance = () => {
		heroBusy = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			heroBusy = false;
		};
	};
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

{#if confettiBurst > 0}
	{#key confettiBurst}
		<Confetti />
	{/key}
{/if}

{#if levelUp}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/50 p-6">
		<div class="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
			<Trophy size={40} class="mx-auto text-amber-500" />
			<h2 class="mt-3 text-2xl font-bold">Level {levelUp.level}!</h2>
			<p class="mt-1 text-lg">You two are now <strong>{levelUp.title}</strong> 🎉</p>
			<button
				onclick={() => (levelUp = null)}
				class="mt-4 w-full rounded-xl bg-accent-600 py-3 font-semibold text-white"
			>
				Keep it going
			</button>
		</div>
	</div>
{/if}

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
			{heroBusy ? 'opacity-40' : ''}"
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
		<form method="post" action="?/complete" class="mt-3" use:enhance={heroEnhance}>
			<input type="hidden" name="taskId" value={hero.task.id} />
			<button
				disabled={heroBusy}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 py-3
					text-base font-semibold text-white disabled:opacity-50"
			>
				<Check size={18} strokeWidth={3} />
				Mark done · +{hero.task.points}
			</button>
		</form>
		<div class="mt-2 flex gap-2">
			<form method="post" action="?/completeTogether" class="flex-1" use:enhance={heroEnhance}>
				<input type="hidden" name="taskId" value={hero.task.id} />
				<button
					disabled={heroBusy}
					class="flex w-full items-center justify-center gap-1.5 rounded-xl border-2
						border-stone-200 py-2 text-sm font-medium text-stone-600 disabled:opacity-50"
				>
					<Handshake size={15} /> We did it together
				</button>
			</form>
			<form method="post" action="?/snooze" class="flex-1" use:enhance={heroEnhance}>
				<input type="hidden" name="taskId" value={hero.task.id} />
				<button
					disabled={heroBusy}
					class="flex w-full items-center justify-center gap-1.5 rounded-xl border-2
						border-stone-200 py-2 text-sm font-medium text-stone-600 disabled:opacity-50"
				>
					<AlarmClockOff size={15} /> Not today
				</button>
			</form>
		</div>
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

{#if overdueCount >= 2}
	<a
		href="/review"
		class="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
	>
		<ClipboardCheck size={16} class="shrink-0" />
		<span class="flex-1">{overdueCount} chores slipped — review them in a minute</span>
		<ChevronRight size={16} />
	</a>
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

{#snippet heartHint()}
	<HandHeart size={15} class="shrink-0 text-pink-600" />
{/snippet}

<!-- Agenda: coming up grouped by day -->
{#if upcomingGroups.length > 0}
	<details class="mb-3 rounded-2xl bg-white shadow-sm">
		<summary class="flex cursor-pointer list-none items-center gap-2 p-4 font-medium select-none">
			<span class="flex-1">Coming up</span>
			<span
				class="flex size-6 shrink-0 items-center justify-center rounded-full bg-stone-100
					text-xs font-semibold text-stone-600"
			>
				{upcoming.length}
			</span>
			<ChevronRight size={16} class="shrink-0 text-stone-500" />
		</summary>
		<div class="flex flex-col gap-3 p-3 pt-0">
			{#each upcomingGroups as group (group.date)}
				<div>
					<h3 class="mb-1.5 text-sm font-semibold text-stone-500">{group.label}</h3>
					<div class="flex flex-col gap-2">
						{#each group.tasks as task (task.id)}
							<TaskItem {task} today={data.today} streak={data.streaks[task.id] ?? 0} subtitle={task.areaName} />
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</details>
{/if}

{@render taskSection('Anytime', anytime, false, null)}

<!-- Quick add an ad-hoc task -->
<details class="mb-3 rounded-2xl border border-dashed border-stone-400">
	<summary
		class="flex cursor-pointer list-none items-center justify-center gap-2 p-3 text-sm
			font-medium text-stone-500 select-none"
	>
		<Plus size={16} /> Add a quick task
	</summary>
	<form method="post" action="?/quickAdd" use:enhance class="flex flex-col gap-3 p-3 pt-0">
		<input
			type="text"
			name="title"
			placeholder="What needs doing?"
			required
			class="rounded-xl border-2 border-stone-200 bg-white px-3 py-2
				focus:border-accent-500 focus:outline-none"
		/>
		<div class="flex gap-2">
			<select
				name="areaId"
				class="min-w-0 flex-1 rounded-xl border-2 border-stone-200 bg-white px-2 py-2 text-sm"
			>
				{#each data.houseAreas as area (area.id)}
					<option value={area.id}>{area.name}</option>
				{/each}
			</select>
			<select name="points" class="rounded-xl border-2 border-stone-200 bg-white px-2 py-2 text-sm">
				<option value="5">+5</option>
				<option value="10" selected>+10</option>
				<option value="20">+20</option>
				<option value="40">+40</option>
			</select>
		</div>
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" name="dueToday" checked class="size-4 accent-emerald-700" />
			Due today (unchecked = anytime)
		</label>
		{#if form?.quickAddMessage}
			<p class="text-sm text-red-600">{form.quickAddMessage}</p>
		{/if}
		<button class="rounded-xl bg-accent-600 py-2.5 font-semibold text-white">Add task</button>
	</form>
</details>

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
					<ReactionBar
						completionId={completion.id}
						reactions={data.reactions}
						users={data.allUsers}
						meId={me.id}
					/>
					<form method="post" action="?/uncomplete" use:enhance>
						<input type="hidden" name="completionId" value={completion.id} />
						<button
							aria-label="Undo {completion.taskTitle}"
							class="text-stone-500 hover:text-stone-700"
						>
							<Undo2 size={16} />
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
