<script lang="ts">
	interface UserOption {
		id: number;
		displayName: string;
		emoji: string;
	}

	let {
		users,
		name = 'ownerUserId',
		selected = $bindable(''),
		sharedLabel = 'Shared'
	}: { users: UserOption[]; name?: string; selected?: string; sharedLabel?: string } = $props();
</script>

<div class="flex gap-2">
	<label
		class="flex-1 cursor-pointer rounded-xl border-2 py-2 text-center text-sm font-medium
			{selected === '' ? 'border-accent-500 bg-accent-50' : 'border-stone-200'}"
	>
		<input type="radio" {name} value="" bind:group={selected} class="sr-only" />
		🤝 {sharedLabel}
	</label>
	{#each users as user (user.id)}
		<label
			class="flex-1 cursor-pointer rounded-xl border-2 py-2 text-center text-sm font-medium
				{selected === String(user.id) ? 'border-accent-500 bg-accent-50' : 'border-stone-200'}"
		>
			<input type="radio" {name} value={String(user.id)} bind:group={selected} class="sr-only" />
			{user.emoji}
			{user.displayName}
		</label>
	{/each}
</div>
