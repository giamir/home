<script lang="ts">
	import { Crown, Flame, HandHeart, Trophy } from '@lucide/svelte';

	let { data } = $props();

	const maxWeekTeam = $derived(Math.max(1, ...data.history.map((w) => w.team)));
	const maxArea = $derived(Math.max(1, ...data.topAreas.map(([, p]) => p)));

	const userColor: Record<number, string> = {};
	$effect.pre(() => {
		data.allUsers.forEach((u, i) => {
			userColor[u.id] = i === 0 ? 'bg-accent-500' : 'bg-sky-600';
		});
	});

	function weekLabel(weekStart: string) {
		const [, m, d] = weekStart.split('-');
		return `${d}/${m}`;
	}

	function dayLabel(localDate: string) {
		if (localDate === data.today) return 'Today';
		const [, m, d] = localDate.split('-');
		return `${d}/${m}`;
	}

	function userById(id: number) {
		return data.allUsers.find((u) => u.id === id);
	}

	const leaderId = $derived.by(() => {
		const entries = Object.entries(data.thisWeek.byUser);
		if (entries.length === 0) return null;
		const max = Math.max(...entries.map(([, p]) => p));
		const leaders = entries.filter(([, p]) => p === max);
		return leaders.length === 1 ? Number(leaders[0][0]) : null;
	});

	const goalPct = $derived(Math.min(100, (data.thisWeek.team / data.weeklyGoal) * 100));

	// Workload balance this week, framed warmly
	const balance = $derived.by(() => {
		const [a, b] = data.allUsers;
		if (!a || !b) return null;
		const pa = data.thisWeek.byUser[a.id] ?? 0;
		const pb = data.thisWeek.byUser[b.id] ?? 0;
		const total = pa + pb;
		if (total === 0) return null;
		const pctA = Math.round((pa / total) * 100);
		let caption: string;
		if (pctA >= 40 && pctA <= 60) caption = 'Beautifully balanced — you two are in sync 💞';
		else {
			const carrier = pctA > 60 ? a.displayName : b.displayName;
			caption = `${carrier} is carrying this week — a thank-you goes a long way 💐`;
		}
		return { a, b, pctA, caption };
	});
</script>

<svelte:head><title>Stats · Home</title></svelte:head>

<h1 class="mb-4 text-xl font-bold">Stats</h1>

<!-- Team level -->
<section class="mb-5 rounded-2xl bg-accent-600 p-4 text-white shadow-sm">
	<div class="flex items-center gap-3">
		<div class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
			<Trophy size={24} />
		</div>
		<div class="min-w-0 flex-1">
			<div class="text-xs font-medium text-emerald-100">Team level {data.teamLevel.level}</div>
			<div class="truncate text-lg font-bold">{data.teamLevel.title}</div>
		</div>
	</div>
	<div class="mt-3 h-2.5 overflow-hidden rounded-full bg-white/25">
		<div
			class="h-full rounded-full bg-white"
			style="width: {(data.teamLevel.progress / data.teamLevel.perLevel) * 100}%"
		></div>
	</div>
	<div class="mt-1.5 flex justify-between text-xs text-emerald-100">
		<span>{data.teamLevel.progress}/{data.teamLevel.perLevel} to level {data.teamLevel.level + 1}</span>
		<span>{data.teamLevel.totalChores} chores · {data.teamLevel.totalPoints} pts together</span>
	</div>
</section>

<!-- This week: score, goal, balance -->
<section class="mb-5 rounded-2xl bg-white p-4 shadow-sm">
	<h2 class="mb-3 text-sm font-semibold text-stone-500">This week</h2>
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
				<div class="text-lg font-bold text-accent-600">{data.thisWeek.byUser[u.id] ?? 0}</div>
			</div>
		{/each}
	</div>

	<div class="mt-4">
		<div class="mb-1 flex justify-between text-xs text-stone-500">
			<span>Team goal: beat your 4-week average</span>
			<span class="font-semibold {data.thisWeek.team >= data.weeklyGoal ? 'text-accent-700' : ''}">
				{data.thisWeek.team}/{data.weeklyGoal}
				{#if data.thisWeek.team >= data.weeklyGoal}🎉{/if}
			</span>
		</div>
		<div class="h-2.5 overflow-hidden rounded-full bg-stone-100">
			<div
				class="h-full rounded-full {data.thisWeek.team >= data.weeklyGoal
					? 'bg-amber-400'
					: 'bg-accent-500'}"
				style="width: {goalPct}%"
			></div>
		</div>
	</div>

	{#if balance}
		<div class="mt-4">
			<div class="flex h-2.5 overflow-hidden rounded-full bg-stone-100">
				<div class="{userColor[balance.a.id]} h-full" style="width: {balance.pctA}%"></div>
				<div class="{userColor[balance.b.id]} h-full" style="width: {100 - balance.pctA}%"></div>
			</div>
			<div class="mt-1 flex justify-between text-xs text-stone-500">
				<span>{balance.a.emoji} {balance.pctA}%</span>
				<span>{100 - balance.pctA}% {balance.b.emoji}</span>
			</div>
			<p class="mt-1.5 text-center text-xs text-stone-600">{balance.caption}</p>
		</div>
	{/if}
</section>

<!-- This week's highlights -->
{#if data.highlights.length > 0}
	<section class="mb-5 grid grid-cols-2 gap-3">
		{#each data.highlights as highlight (highlight.title)}
			{@const holder = userById(highlight.userId)}
			<div class="rounded-2xl bg-white p-3 text-center shadow-sm">
				<div class="text-2xl">{highlight.emoji}</div>
				<div class="text-sm font-semibold">{highlight.title}</div>
				<div class="text-xs text-stone-500">{holder?.emoji} {holder?.displayName}</div>
			</div>
		{/each}
	</section>
{/if}

<!-- Weekly history with crowns -->
{#if data.history.length > 0}
	<section class="mb-5 rounded-2xl bg-white p-4 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-stone-500">Past weeks</h2>
		<div class="flex flex-col gap-2">
			{#each data.history as week (week.weekStart)}
				<div class="flex items-center gap-2">
					<span class="w-11 shrink-0 text-xs text-stone-500">{weekLabel(week.weekStart)}</span>
					<div class="flex h-4 flex-1 gap-px overflow-hidden rounded-full bg-stone-100">
						{#each data.allUsers as u (u.id)}
							<div
								class="{userColor[u.id]} h-full"
								style="width: {((week.byUser[u.id] ?? 0) / maxWeekTeam) * 100}%"
							></div>
						{/each}
					</div>
					<span class="w-8 shrink-0 text-right text-xs font-medium">{week.team}</span>
					<span class="w-6 shrink-0 text-center text-sm">
						{week.winnerId !== null ? `${userById(week.winnerId)?.emoji}` : '🤝'}
					</span>
				</div>
			{/each}
		</div>
		<div class="mt-3 flex justify-center gap-4 text-xs text-stone-500">
			{#each data.allUsers as u (u.id)}
				<span class="flex items-center gap-1">
					<span class="size-2 rounded-full {userColor[u.id]}"></span>
					{u.displayName}
				</span>
			{/each}
			<span>🤝 = tie</span>
		</div>
	</section>
{/if}

<!-- Covering + on-time -->
<section class="mb-5 grid grid-cols-2 gap-3">
	<div class="rounded-2xl bg-white p-4 shadow-sm">
		<h2 class="mb-2 flex items-center gap-1 text-sm font-semibold text-stone-500">
			<HandHeart size={15} class="text-pink-600" /> Covered
		</h2>
		{#each data.allUsers as u (u.id)}
			<div class="flex justify-between text-sm">
				<span>{u.emoji} {u.displayName}</span>
				<span class="font-semibold">{data.covering[u.id] ?? 0}×</span>
			</div>
		{/each}
		<p class="mt-1.5 text-xs text-stone-500">times covering for each other (12 weeks)</p>
	</div>
	<div class="rounded-2xl bg-white p-4 shadow-sm">
		<h2 class="mb-2 text-sm font-semibold text-stone-500">⏱ On time</h2>
		{#each data.allUsers as u (u.id)}
			<div class="flex justify-between text-sm">
				<span>{u.emoji} {u.displayName}</span>
				<span class="font-semibold">
					{data.onTimeByUser[u.id] === null ? '—' : `${data.onTimeByUser[u.id]}%`}
				</span>
			</div>
		{/each}
		<p class="mt-1.5 text-xs text-stone-500">of chores done by their due date</p>
	</div>
</section>

<!-- Streaks -->
{#if data.streaks.length > 0}
	<section class="mb-5 rounded-2xl bg-white p-4 shadow-sm">
		<h2 class="mb-2 text-sm font-semibold text-stone-500">Hot streaks</h2>
		<div class="flex flex-col gap-1.5">
			{#each data.streaks as streak (streak.house + streak.title)}
				<div class="flex items-center justify-between text-sm">
					<span>{streak.house} {streak.title}</span>
					<span class="flex items-center gap-0.5 font-semibold text-orange-700">
						<Flame size={14} />{streak.streak}
					</span>
				</div>
			{/each}
		</div>
	</section>
{/if}

<!-- Recent activity -->
{#if data.activity.length > 0}
	<section class="mb-5 rounded-2xl bg-white p-4 shadow-sm">
		<h2 class="mb-2 text-sm font-semibold text-stone-500">Recent activity</h2>
		<div class="flex flex-col gap-1.5">
			{#each data.activity as entry (entry.id)}
				{@const doer = userById(entry.userId)}
				<div class="flex items-center gap-2 text-sm">
					<span class="w-11 shrink-0 text-xs text-stone-500">{dayLabel(entry.localDate)}</span>
					<span class="shrink-0">{doer?.emoji}</span>
					<span class="min-w-0 flex-1 truncate">
						{entry.taskTitle}
						{#if entry.covered}
							<HandHeart size={13} class="inline text-pink-600" />
						{/if}
					</span>
					<span class="shrink-0 text-xs text-stone-500">
						{entry.houseEmoji} +{entry.pointsAwarded}
					</span>
				</div>
			{/each}
		</div>
	</section>
{/if}

<!-- Per house + per area, last 30 days -->
<section class="mb-5 rounded-2xl bg-white p-4 shadow-sm">
	<h2 class="mb-2 text-sm font-semibold text-stone-500">Last 30 days</h2>
	<div class="mb-3 flex justify-around">
		{#each Object.entries(data.housesById) as [id, house] (id)}
			<div class="text-center">
				<div class="text-xl">{house.emoji}</div>
				<div class="text-xs text-stone-500">{house.name}</div>
				<div class="font-bold">{data.byHouse[Number(id)] ?? 0}</div>
			</div>
		{/each}
	</div>
	{#if data.topAreas.length > 0}
		<div class="flex flex-col gap-1.5">
			{#each data.topAreas as [label, points] (label)}
				<div class="flex items-center gap-2 text-sm">
					<span class="w-32 shrink-0 truncate text-xs text-stone-500">{label}</span>
					<div class="h-3 flex-1 overflow-hidden rounded-full bg-stone-100">
						<div class="h-full bg-accent-500" style="width: {(points / maxArea) * 100}%"></div>
					</div>
					<span class="w-8 shrink-0 text-right text-xs font-medium">{points}</span>
				</div>
			{/each}
		</div>
	{/if}
</section>
