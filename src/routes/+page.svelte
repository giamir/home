<script lang="ts">
	import { Crown, Eye, HandHeart, PartyPopper, Sparkles } from '@lucide/svelte';
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

	const myPoints = $derived(data.score.byUser[me.id] ?? 0);
	const partnerPoints = $derived(partner ? (data.score.byUser[partner.id] ?? 0) : 0);
	const myDoneToday = $derived(data.doneToday[me.id] ?? 0);
	const overdueMine = $derived(mine.filter((t) => t.nextDueDate! < data.today).length);
	const bestStreak = $derived(Math.max(0, ...mine.map((t) => data.streaks[t.id] ?? 0)));

	const encouragement = $derived.by(() => {
		const name = partner?.displayName ?? 'your partner';
		if (mine.length === 0 && shared.length === 0) {
			return myDoneToday > 0
				? `Everything on your side is done — ${myDoneToday} chore${myDoneToday === 1 ? '' : 's'} today. Enjoy the rest of the day! 🎉`
				: 'Nothing on your plate right now — all clear ✨';
		}
		if (overdueMine > 0) {
			return `${overdueMine} slipped past — a quick win is waiting for you 💪`;
		}
		if (myDoneToday > 0) {
			return `${myDoneToday} down already today — nice momentum, keep it rolling 🔥`;
		}
		if (bestStreak > 1) {
			return `You're protecting a ${bestStreak}-streak — don't let it slip today 🔥`;
		}
		if (myPoints > partnerPoints && partnerPoints > 0) {
			return `You're leading ${myPoints}–${partnerPoints} this week — champion pace 👑`;
		}
		if (partnerPoints > myPoints) {
			return `${name} is ahead ${partnerPoints}–${myPoints} — comeback time? 😏`;
		}
		return 'Fresh slate — the first chore sets the tone for the day ✨';
	});

	const leaderId = $derived.by(() => {
		const entries = Object.entries(data.score.byUser);
		if (entries.length === 0) return null;
		const max = Math.max(...entries.map(([, p]) => p));
		const leaders = entries.filter(([, p]) => p === max);
		return leaders.length === 1 ? Number(leaders[0][0]) : null;
	});
</script>

<svelte:head><title>Today · Home</title></svelte:head>

<header class="mb-1 flex items-center justify-between gap-2">
	<h1 class="text-xl font-bold">{greeting}, {me.displayName} {me.emoji}</h1>
	<HouseSwitcher households={data.households} currentHouseholdId={me.currentHouseholdId ?? null} />
</header>
<p class="mb-4 flex items-center gap-1.5 text-sm text-stone-500">
	<Sparkles size={14} class="shrink-0 text-amber-500" />
	{encouragement}
</p>

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

{#if mine.length === 0 && shared.length === 0 && partners.length === 0}
	<div class="mb-6 flex items-center gap-3 rounded-2xl bg-accent-50 p-4 text-accent-700">
		<PartyPopper size={22} class="shrink-0" />
		<div class="text-sm font-medium">
			{data.household.name} is all caught up — nothing due today!
		</div>
	</div>
{/if}

{#if mine.length > 0}
	<section class="mb-6">
		<h2 class="mb-2 text-sm font-semibold text-stone-500">Yours today</h2>
		<div class="flex flex-col gap-2">
			{#each mine as task (task.id)}
				<TaskItem {task} today={data.today} streak={data.streaks[task.id] ?? 0} subtitle={task.areaName} />
			{/each}
		</div>
	</section>
{/if}

{#if shared.length > 0}
	<section class="mb-6">
		<h2 class="mb-2 text-sm font-semibold text-stone-500">🤝 Up for grabs</h2>
		<div class="flex flex-col gap-2">
			{#each shared as task (task.id)}
				<TaskItem {task} today={data.today} streak={data.streaks[task.id] ?? 0} subtitle={task.areaName} />
			{/each}
		</div>
	</section>
{/if}

{#if partner && partners.length > 0}
	<section class="mb-6">
		<h2 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-500">
			{partner.emoji} On {partner.displayName}'s plate
			<span class="flex items-center gap-0.5 text-xs font-normal text-pink-500">
				<HandHeart size={12} /> cover one to earn a shout-out
			</span>
		</h2>
		<div class="flex flex-col gap-2">
			{#each partners as task (task.id)}
				<TaskItem {task} today={data.today} streak={data.streaks[task.id] ?? 0} subtitle={task.areaName} />
			{/each}
		</div>
	</section>
{/if}

{#if upcoming.length > 0}
	<section class="mb-6">
		<h2 class="mb-2 text-sm font-semibold text-stone-500">Coming up</h2>
		<div class="flex flex-col gap-2">
			{#each upcoming as task (task.id)}
				<TaskItem {task} today={data.today} streak={data.streaks[task.id] ?? 0} subtitle={task.areaName} />
			{/each}
		</div>
	</section>
{/if}

{#if anytime.length > 0}
	<section class="mb-6">
		<h2 class="mb-2 text-sm font-semibold text-stone-500">Anytime</h2>
		<div class="flex flex-col gap-2">
			{#each anytime as task (task.id)}
				<TaskItem {task} today={data.today} streak={data.streaks[task.id] ?? 0} subtitle={task.areaName} />
			{/each}
		</div>
	</section>
{/if}

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
