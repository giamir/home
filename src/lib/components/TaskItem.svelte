<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, Flame, Repeat } from '@lucide/svelte';
	import { daysBetween } from '$lib/dates';

	interface TaskView {
		id: number;
		title: string;
		points: number;
		nextDueDate: string | null;
		isRecurring: boolean;
	}

	import type { Snippet } from 'svelte';

	let {
		task,
		today,
		streak = 0,
		subtitle = '',
		extra
	}: {
		task: TaskView;
		today: string;
		streak?: number;
		subtitle?: string;
		extra?: Snippet;
	} = $props();

	let completing = $state(false);

	const due = $derived.by(() => {
		if (!task.nextDueDate) return { label: 'Anytime', tone: 'text-stone-500' };
		const diff = daysBetween(today, task.nextDueDate);
		if (diff < 0)
			return { label: `${-diff}d overdue`, tone: 'text-red-600 font-semibold' };
		if (diff === 0) return { label: 'Today', tone: 'text-amber-700 font-semibold' };
		if (diff === 1) return { label: 'Tomorrow', tone: 'text-stone-500' };
		return { label: `In ${diff} days`, tone: 'text-stone-500' };
	});
</script>

<div
	class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm transition-opacity
		{completing ? 'opacity-40' : ''}"
>
	<form
		method="post"
		action="?/complete"
		use:enhance={() => {
			completing = true;
			return async ({ update }) => {
				await update();
				completing = false;
			};
		}}
	>
		<input type="hidden" name="taskId" value={task.id} />
		<button
			aria-label="Mark {task.title} as done"
			disabled={completing}
			class="group flex size-9 items-center justify-center rounded-full border-2
				border-stone-500 text-transparent transition-colors
				hover:border-accent-500 hover:bg-accent-50 hover:text-accent-600
				active:border-accent-600 active:bg-accent-100"
		>
			<Check size={18} strokeWidth={3} />
		</button>
	</form>

	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-1.5 truncate font-medium">
			{task.title}
			{#if task.isRecurring}
				<Repeat size={13} class="shrink-0 text-stone-500" />
			{/if}
			{#if streak > 1}
				<span class="flex shrink-0 items-center text-xs font-semibold text-orange-700">
					<Flame size={13} />{streak}
				</span>
			{/if}
		</div>
		{#if subtitle}
			<div class="truncate text-xs text-stone-500">{subtitle}</div>
		{/if}
	</div>

	<div class="shrink-0 text-right">
		<div class="text-xs {due.tone}">{due.label}</div>
		<div class="text-xs text-stone-500">+{task.points}</div>
	</div>

	{#if extra}
		{@render extra()}
	{/if}
</div>
