<script lang="ts">
	import { enhance } from '$app/forms';
	import { SmilePlus } from '@lucide/svelte';

	interface Reaction {
		completionId: number;
		userId: number;
		emoji: string;
	}

	interface UserOption {
		id: number;
		displayName: string;
		emoji: string;
	}

	const EMOJIS = ['💚', '😂', '👏', '🔥', '⭐'];

	let {
		completionId,
		reactions,
		users,
		meId
	}: {
		completionId: number;
		reactions: Reaction[];
		users: UserOption[];
		meId: number;
	} = $props();

	let pickerOpen = $state(false);

	const own = $derived(reactions.filter((r) => r.completionId === completionId));
	const mine = $derived(own.find((r) => r.userId === meId));
</script>

<div class="flex items-center gap-1">
	{#each own as reaction (reaction.userId)}
		{@const reactor = users.find((u) => u.id === reaction.userId)}
		<span
			class="rounded-full bg-stone-100 px-1.5 py-0.5 text-sm"
			title="from {reactor?.displayName}"
		>
			{reaction.emoji}
		</span>
	{/each}

	{#if pickerOpen}
		<form
			method="post"
			action="?/react"
			use:enhance={() => {
				pickerOpen = false;
				return async ({ update }) => update();
			}}
			class="flex items-center gap-0.5 rounded-full bg-stone-100 px-1"
		>
			<input type="hidden" name="completionId" value={completionId} />
			{#each EMOJIS as emoji (emoji)}
				<button
					name="emoji"
					value={emoji}
					aria-label="React with {emoji}"
					class="rounded-full p-1 text-base {mine?.emoji === emoji ? 'bg-accent-100' : ''}"
				>
					{emoji}
				</button>
			{/each}
		</form>
	{:else}
		<button
			aria-label="Add reaction"
			onclick={() => (pickerOpen = true)}
			class="p-1 text-stone-500 hover:text-stone-700"
		>
			<SmilePlus size={16} />
		</button>
	{/if}
</div>
