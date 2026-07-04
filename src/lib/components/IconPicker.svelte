<script lang="ts">
	import { AREA_ICONS } from '$lib/icons';

	let { selected = $bindable('house') }: { selected?: string } = $props();
</script>

<div class="grid grid-cols-7 gap-1.5">
	{#each Object.entries(AREA_ICONS) as [name, Icon] (name)}
		<label
			class="flex cursor-pointer items-center justify-center rounded-xl border-2 p-2
				{selected === name ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-stone-200 text-stone-500'}"
		>
			<input type="radio" name="icon" value={name} bind:group={selected} class="sr-only" />
			<Icon size={18} />
		</label>
	{/each}
</div>
