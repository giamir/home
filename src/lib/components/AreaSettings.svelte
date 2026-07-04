<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Trash2 } from '@lucide/svelte';
	import IconPicker from './IconPicker.svelte';
	import OwnerSelect from './OwnerSelect.svelte';
	import type { Area, Household } from '$lib/server/db/schema';

	interface UserOption {
		id: number;
		displayName: string;
		emoji: string;
	}

	let {
		area,
		otherHousehold,
		users,
		message = ''
	}: {
		area: Area;
		otherHousehold: Household | null;
		users: UserOption[];
		message?: string;
	} = $props();

	let icon = $state(area.icon);
	let owner = $state(area.ownerUserId ? String(area.ownerUserId) : '');
</script>

<details class="mb-4 rounded-2xl bg-white shadow-sm">
	<summary class="cursor-pointer list-none p-3 text-sm font-medium text-stone-500">
		⚙️ Area settings
	</summary>
	<div class="flex flex-col gap-4 p-3 pt-0">
		<form method="post" action="?/updateArea" use:enhance class="flex flex-col gap-3">
			<input
				type="text"
				name="name"
				value={area.name}
				required
				class="rounded-xl border-2 border-stone-200 px-3 py-2 focus:border-accent-500 focus:outline-none"
			/>
			<IconPicker bind:selected={icon} />
			<OwnerSelect {users} bind:selected={owner} />
			{#if message}
				<p class="text-sm text-red-600">{message}</p>
			{/if}
			<button class="rounded-xl bg-accent-600 py-2.5 font-semibold text-white">Save changes</button>
		</form>

		{#if otherHousehold}
			<form method="post" action="?/duplicateArea" use:enhance>
				<button
					class="flex w-full items-center justify-center gap-2 rounded-xl border-2
						border-stone-200 py-2.5 text-sm font-medium"
				>
					<Copy size={15} />
					Copy to {otherHousehold.emoji} {otherHousehold.name}
				</button>
			</form>
		{/if}

		<form method="post" action="?/archiveArea" use:enhance>
			<button class="flex w-full items-center justify-center gap-1 py-1 text-sm text-red-600">
				<Trash2 size={14} /> Archive this area
			</button>
		</form>
	</div>
</details>
