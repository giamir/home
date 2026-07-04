<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		ArrowLeft,
		Calendar,
		Check,
		FastForward,
		Handshake,
		PartyPopper,
		Trash2
	} from '@lucide/svelte';

	let { data } = $props();

	let busy = $state(false);
	let showDatePicker = $state(false);

	// Always review the most-overdue task first; the list refreshes after
	// every action, so the "current card" is simply the head of the list.
	const current = $derived(data.overdue[0]);
	const total = $derived(data.overdue.length);

	const cardEnhance = () => {
		busy = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			busy = false;
			showDatePicker = false;
		};
	};
</script>

<svelte:head><title>Review · Home</title></svelte:head>

<a href="/" class="mb-3 inline-flex items-center gap-1 text-sm text-stone-500">
	<ArrowLeft size={16} /> Today
</a>

<h1 class="mb-1 text-xl font-bold">Weekly review</h1>
<p class="mb-5 text-base text-stone-600">
	{#if total > 0}
		A minute of honesty — decide together, no guilt. {total} left.
	{:else}
		Everything's accounted for. Lovely.
	{/if}
</p>

{#if current}
	<section class="mb-4 rounded-2xl bg-white p-5 shadow-sm {busy ? 'opacity-40' : ''}">
		<div class="text-sm text-stone-500">
			{current.houseEmoji}
			{current.houseName} · {current.areaName}
		</div>
		<h2 class="mt-1 text-2xl font-bold">{current.title}</h2>
		<p class="mt-1 text-sm">
			<span class="font-semibold text-red-600">
				{current.daysOverdue} day{current.daysOverdue === 1 ? '' : 's'} overdue
			</span>
			<span class="text-stone-500"> · {current.cadence} · +{current.points}</span>
		</p>

		<div class="mt-4 flex flex-col gap-2">
			<div class="flex gap-2">
				<form method="post" action="?/complete" class="flex-1" use:enhance={cardEnhance}>
					<input type="hidden" name="taskId" value={current.id} />
					<button
						disabled={busy}
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600
							py-3 font-semibold text-white disabled:opacity-50"
					>
						<Check size={17} strokeWidth={3} /> Did it
					</button>
				</form>
				<form method="post" action="?/completeTogether" class="flex-1" use:enhance={cardEnhance}>
					<input type="hidden" name="taskId" value={current.id} />
					<button
						disabled={busy}
						class="flex w-full items-center justify-center gap-2 rounded-xl border-2
							border-accent-200 py-3 font-semibold text-accent-700 disabled:opacity-50"
					>
						<Handshake size={17} /> Together
					</button>
				</form>
			</div>

			<form method="post" action="?/skip" use:enhance={cardEnhance}>
				<input type="hidden" name="taskId" value={current.id} />
				<button
					disabled={busy}
					class="flex w-full items-center justify-center gap-2 rounded-xl border-2
						border-stone-200 py-2.5 text-sm font-medium text-stone-600 disabled:opacity-50"
				>
					<FastForward size={15} />
					Skip — next {current.isRecurring ? current.cadence.replace('every ', '') : 'week'}
				</button>
			</form>

			{#if showDatePicker}
				<form
					method="post"
					action="?/reschedule"
					use:enhance={cardEnhance}
					class="flex gap-2"
				>
					<input type="hidden" name="taskId" value={current.id} />
					<input
						type="date"
						name="date"
						required
						class="min-w-0 flex-1 rounded-xl border-2 border-stone-200 px-3 py-2 text-sm"
					/>
					<button
						disabled={busy}
						class="rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
					>
						Set
					</button>
				</form>
			{:else}
				<div class="flex gap-2">
					<button
						onclick={() => (showDatePicker = true)}
						class="flex flex-1 items-center justify-center gap-2 rounded-xl border-2
							border-stone-200 py-2.5 text-sm font-medium text-stone-600"
					>
						<Calendar size={15} /> Pick a date
					</button>
					<form method="post" action="?/retire" class="flex-1" use:enhance={cardEnhance}>
						<input type="hidden" name="taskId" value={current.id} />
						<button
							disabled={busy}
							class="flex w-full items-center justify-center gap-2 rounded-xl border-2
								border-stone-200 py-2.5 text-sm font-medium text-red-600 disabled:opacity-50"
						>
							<Trash2 size={15} /> Retire it
						</button>
					</form>
				</div>
			{/if}
		</div>
	</section>
{:else}
	<section class="mb-5 flex items-center gap-3 rounded-2xl bg-accent-50 p-5 text-accent-700">
		<PartyPopper size={28} class="shrink-0" />
		<div>
			<div class="text-lg font-semibold">Nothing overdue!</div>
			<div class="text-sm">Here's what the next week looks like.</div>
		</div>
	</section>
{/if}

{#if data.preview.length > 0}
	<section class="mb-5">
		<h2 class="mb-2 text-sm font-semibold text-stone-500">Next 7 days</h2>
		<div class="flex flex-col gap-1.5">
			{#each data.preview as task (task.id)}
				<div class="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
					<span class="shrink-0">{task.houseEmoji}</span>
					<span class="min-w-0 flex-1 truncate">{task.title}</span>
					<span class="shrink-0 text-xs text-stone-500">
						{task.inDays === 0 ? 'today' : task.inDays === 1 ? 'tomorrow' : `in ${task.inDays}d`}
					</span>
				</div>
			{/each}
		</div>
	</section>
{/if}
