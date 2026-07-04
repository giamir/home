<script lang="ts">
	import { enhance } from '$app/forms';
	import OwnerSelect from './OwnerSelect.svelte';

	interface UserOption {
		id: number;
		displayName: string;
		emoji: string;
	}

	interface TaskValues {
		id?: number;
		title: string;
		notes: string | null;
		points: number;
		assignedUserId: number | null;
		isRecurring: boolean;
		recurrenceInterval: number | null;
		recurrenceUnit: string | null;
		nextDueDate: string | null;
		remindWhenAway: boolean;
	}

	let {
		users,
		action,
		task = null,
		submitLabel = 'Save',
		onsaved = () => {}
	}: {
		users: UserOption[];
		action: string;
		task?: TaskValues | null;
		submitLabel?: string;
		onsaved?: () => void;
	} = $props();

	let isRecurring = $state(task?.isRecurring ?? false);
	let assigned = $state(task?.assignedUserId ? String(task.assignedUserId) : '');
	let points = $state(task?.points ?? 10);
</script>

<form
	method="post"
	{action}
	use:enhance={() => {
		return async ({ update }) => {
			await update();
			onsaved();
		};
	}}
	class="flex flex-col gap-3"
>
	{#if task?.id}
		<input type="hidden" name="taskId" value={task.id} />
	{/if}

	<input
		type="text"
		name="title"
		placeholder="Task title"
		value={task?.title ?? ''}
		required
		class="rounded-xl border-2 border-stone-200 px-3 py-2 focus:border-accent-500 focus:outline-none"
	/>

	<div>
		<div class="mb-1 text-xs font-medium text-stone-500">Points</div>
		<div class="flex gap-2">
			{#each [5, 10, 20, 40] as value (value)}
				<label
					class="flex-1 cursor-pointer rounded-xl border-2 py-1.5 text-center text-sm font-semibold
						{points === value ? 'border-accent-500 bg-accent-50' : 'border-stone-200'}"
				>
					<input type="radio" name="points" {value} bind:group={points} class="sr-only" />
					{value}
				</label>
			{/each}
		</div>
	</div>

	<div>
		<div class="mb-1 text-xs font-medium text-stone-500">Who's responsible?</div>
		<OwnerSelect {users} name="assignedUserId" bind:selected={assigned} sharedLabel="Area owner" />
	</div>

	<div class="flex items-center justify-between gap-3">
		<label class="flex items-center gap-2 text-sm font-medium">
			<input type="checkbox" name="isRecurring" bind:checked={isRecurring} class="size-4 accent-emerald-700" />
			Repeats
		</label>
		{#if isRecurring}
			<div class="flex items-center gap-1.5 text-sm">
				every
				<input
					type="number"
					name="recurrenceInterval"
					min="1"
					max="99"
					value={task?.recurrenceInterval ?? 1}
					class="w-14 rounded-lg border-2 border-stone-200 px-2 py-1 text-center"
				/>
				<select
					name="recurrenceUnit"
					class="rounded-lg border-2 border-stone-200 px-1 py-1"
				>
					{#each ['day', 'week', 'month'] as unit (unit)}
						<option value={unit} selected={task?.recurrenceUnit === unit}>{unit}(s)</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>

	<label class="flex items-center justify-between gap-2 text-sm font-medium">
		Due date
		<input
			type="date"
			name="nextDueDate"
			value={task?.nextDueDate ?? ''}
			class="rounded-lg border-2 border-stone-200 px-2 py-1"
		/>
	</label>

	<label class="flex items-center gap-2 text-sm">
		<input
			type="checkbox"
			name="remindWhenAway"
			checked={task?.remindWhenAway ?? false}
			class="size-4 accent-emerald-700"
		/>
		Remind even when nobody's home
		<span class="text-xs text-stone-500">(plants, bills…)</span>
	</label>

	<button class="rounded-xl bg-accent-600 py-2.5 font-semibold text-white">{submitLabel}</button>
</form>
