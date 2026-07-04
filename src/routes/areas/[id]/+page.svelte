<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Archive,
		ArchiveRestore,
		ArrowLeft,
		Check,
		HandHeart,
		Pencil,
		Plus,
		Trash2,
		Undo2,
		X
	} from '@lucide/svelte';
	import AreaSettings from '$lib/components/AreaSettings.svelte';
	import ReactionBar from '$lib/components/ReactionBar.svelte';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import TaskItem from '$lib/components/TaskItem.svelte';
	import { areaIcon } from '$lib/icons';

	let { data, form } = $props();

	const Icon = $derived(areaIcon(data.area.icon));
	const owner = $derived(data.allUsers.find((u) => u.id === data.area.ownerUserId));

	let editingTaskId = $state<number | null>(null);
	let addingTask = $state(false);

	function completionDate(value: Date) {
		return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	}
</script>

<svelte:head><title>{data.area.name} · Home</title></svelte:head>

<a href="/areas" class="mb-3 inline-flex items-center gap-1 text-sm text-stone-500">
	<ArrowLeft size={16} /> Areas
</a>

<header class="mb-4 flex items-center gap-3">
	<div class="flex size-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
		<Icon size={24} />
	</div>
	<div class="flex-1">
		<h1 class="text-xl font-bold">{data.area.name}</h1>
		<div class="text-sm text-stone-500">
			{data.household.emoji}
			{data.household.name} ·
			{owner ? `${owner.emoji} ${owner.displayName}'s` : '🤝 Shared'}
		</div>
	</div>
</header>

<!-- Tasks -->
<section class="mb-6">
	<h2 class="mb-2 text-sm font-semibold text-stone-500">Tasks</h2>
	<div class="flex flex-col gap-2">
		{#each data.tasks as task (task.id)}
			<TaskItem {task} today={data.today} streak={data.streaks[task.id] ?? 0}>
				{#snippet extra()}
					<button
						aria-label="Edit {task.title}"
						onclick={() => (editingTaskId = editingTaskId === task.id ? null : task.id)}
						class="ml-1 text-stone-500"
					>
						<Pencil size={16} />
					</button>
				{/snippet}
			</TaskItem>
			{#if editingTaskId === task.id}
				<div class="rounded-2xl border-2 border-accent-200 bg-white p-3">
					<TaskForm
						users={data.allUsers}
						action="?/updateTask"
						{task}
						onsaved={() => (editingTaskId = null)}
					/>
					<div class="mt-2 flex items-center">
						<a
							href="/tasks/{task.id}"
							class="flex flex-1 items-center justify-center gap-1 py-2 text-sm font-medium text-stone-600"
						>
							📜 History
						</a>
						<form method="post" action="?/archiveTask" use:enhance class="flex-1">
							<input type="hidden" name="taskId" value={task.id} />
							<button class="flex w-full items-center justify-center gap-1 py-2 text-sm text-red-600">
								<Trash2 size={14} /> Remove task
							</button>
						</form>
					</div>
				</div>
			{/if}
		{:else}
			<p class="rounded-2xl bg-white p-4 text-center text-sm text-stone-500">No tasks yet.</p>
		{/each}
	</div>

	{#if addingTask}
		<div class="mt-3 rounded-2xl border-2 border-accent-200 bg-white p-3">
			<TaskForm
				users={data.allUsers}
				action="?/addTask"
				submitLabel="Add task"
				onsaved={() => (addingTask = false)}
			/>
			<button onclick={() => (addingTask = false)} class="mt-2 w-full py-1 text-sm text-stone-500">
				Cancel
			</button>
		</div>
	{:else}
		<button
			onclick={() => (addingTask = true)}
			class="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed
				border-stone-400 p-3 text-sm font-medium text-stone-500"
		>
			<Plus size={16} /> New task
		</button>
	{/if}
</section>

<!-- Responsibilities -->
<section class="mb-6">
	<h2 class="mb-2 text-sm font-semibold text-stone-500">What owning this means</h2>
	<div class="flex flex-col gap-1.5">
		{#each data.responsibilities as resp (resp.id)}
			<form
				method="post"
				action="?/updateResponsibility"
				use:enhance
				class="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 shadow-sm"
			>
				<input type="hidden" name="responsibilityId" value={resp.id} />
				<input
					type="text"
					name="text"
					value={resp.text}
					class="min-w-0 flex-1 bg-transparent py-1 text-sm focus:outline-none"
				/>
				<button aria-label="Save" class="text-stone-500 hover:text-accent-600">
					<Check size={15} />
				</button>
				<button
					aria-label="Delete"
					formaction="?/deleteResponsibility"
					class="text-stone-500 hover:text-red-600"
				>
					<X size={15} />
				</button>
			</form>
		{/each}
	</div>
	<form method="post" action="?/addResponsibility" use:enhance class="mt-2 flex gap-2">
		<input
			type="text"
			name="text"
			placeholder="Add a responsibility…"
			required
			class="min-w-0 flex-1 rounded-xl border-2 border-stone-200 px-3 py-2 text-sm
				focus:border-accent-500 focus:outline-none"
		/>
		<button aria-label="Add" class="rounded-xl bg-accent-600 px-3 text-white">
			<Plus size={18} />
		</button>
	</form>
</section>

<!-- Recent activity -->
{#if data.recentCompletions.length > 0}
	<section class="mb-6">
		<h2 class="mb-2 text-sm font-semibold text-stone-500">Recently done</h2>
		<div class="flex flex-col gap-1.5">
			{#each data.recentCompletions as completion (completion.id)}
				<div class="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
					<span>{completion.userEmoji}</span>
					<span class="min-w-0 flex-1 truncate">
						{completion.taskTitle}
						{#if completion.coveredForUserId}
							<HandHeart size={13} class="inline text-pink-600" />
						{/if}
					</span>
					<span class="text-xs text-stone-500">
						{completionDate(completion.completedAt)} · +{completion.pointsAwarded}
					</span>
					<ReactionBar
						completionId={completion.id}
						reactions={data.reactions}
						users={data.allUsers}
						meId={data.user!.id}
					/>
					<form method="post" action="?/uncomplete" use:enhance>
						<input type="hidden" name="completionId" value={completion.id} />
						<button aria-label="Undo" class="text-stone-500 hover:text-stone-700">
							<Undo2 size={15} />
						</button>
					</form>
				</div>
			{/each}
		</div>
	</section>
{/if}

<!-- Archived tasks (removed by hand or completed one-offs) -->
{#if data.archivedTasks.length > 0}
	<details class="mb-4 rounded-2xl bg-white shadow-sm">
		<summary
			class="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium text-stone-500"
		>
			<Archive size={15} /> Archived tasks ({data.archivedTasks.length})
		</summary>
		<div class="flex flex-col gap-1.5 p-3 pt-0">
			{#each data.archivedTasks as task (task.id)}
				<form
					method="post"
					action="?/restoreTask"
					use:enhance
					class="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm"
				>
					<input type="hidden" name="taskId" value={task.id} />
					<span class="min-w-0 flex-1 truncate text-stone-600">{task.title}</span>
					<button
						class="flex shrink-0 items-center gap-1 text-xs font-medium text-accent-700"
					>
						<ArchiveRestore size={14} /> Restore
					</button>
				</form>
			{/each}
		</div>
	</details>
{/if}

<!-- Area settings -->
{#key data.area.id}
	<AreaSettings
		area={data.area}
		otherHousehold={data.otherHousehold}
		users={data.allUsers}
		message={form?.message ?? ''}
	/>
{/key}
