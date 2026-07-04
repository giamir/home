<script lang="ts">
	import { enhance } from '$app/forms';
	import { KeyRound, LogOut } from '@lucide/svelte';
	import NotificationSettings from '$lib/components/NotificationSettings.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Settings · Home</title></svelte:head>

<h1 class="mb-4 text-xl font-bold">Settings</h1>

<div class="mb-3 rounded-2xl bg-white p-4 shadow-sm">
	<div class="flex items-center gap-3">
		<span class="text-3xl">{data.user?.emoji}</span>
		<div>
			<div class="font-semibold">{data.user?.displayName}</div>
			<div class="text-xs text-stone-500">@{data.user?.username}</div>
		</div>
	</div>
</div>

<div class="mb-3">
	<NotificationSettings />
</div>

<!-- Capacity: fairness is judged against real life, not rigid 50/50 -->
<div class="mb-3 rounded-2xl bg-white p-4 shadow-sm">
	<h2 class="mb-1 text-sm font-semibold text-stone-500">🔋 My capacity this week</h2>
	<p class="mb-3 text-sm text-stone-600">
		Big work week or travelling? Lower it — the balance meter judges against what's realistic.
	</p>
	<form method="post" action="?/setCapacity" use:enhance class="flex gap-2">
		{#each [25, 50, 75, 100] as capacity (capacity)}
			<button
				name="capacity"
				value={capacity}
				class="flex-1 rounded-xl border-2 py-2 text-sm font-semibold
					{data.user?.capacityPercent === capacity
					? 'border-accent-500 bg-accent-50'
					: 'border-stone-200'}"
			>
				{capacity}%
			</button>
		{/each}
	</form>
	{#if form?.capacitySaved}
		<p class="mt-2 text-sm text-accent-700">Saved ✓</p>
	{/if}
</div>

<!-- Households -->
<div class="mb-3 flex flex-col gap-3">
	{#each data.households as household (household.id)}
		<details class="rounded-2xl bg-white shadow-sm">
			<summary class="cursor-pointer list-none p-4 text-sm font-medium">
				{household.emoji}
				{household.name}
				<span class="ml-1 text-xs font-normal text-stone-500">{household.timezone}</span>
			</summary>
			<form
				method="post"
				action="?/updateHousehold"
				use:enhance
				class="flex flex-col gap-3 p-4 pt-0"
			>
				<input type="hidden" name="householdId" value={household.id} />
				<div class="flex gap-2">
					<input
						type="text"
						name="emoji"
						value={household.emoji}
						class="w-16 rounded-xl border-2 border-stone-200 px-2 py-2 text-center"
					/>
					<input
						type="text"
						name="name"
						value={household.name}
						required
						class="min-w-0 flex-1 rounded-xl border-2 border-stone-200 px-3 py-2
							focus:border-accent-500 focus:outline-none"
					/>
				</div>
				<label class="flex items-center justify-between gap-2 text-sm">
					Timezone
					<select name="timezone" class="rounded-lg border-2 border-stone-200 px-2 py-1.5">
						{#each data.timezones as tz (tz)}
							<option value={tz} selected={household.timezone === tz}>{tz}</option>
						{/each}
					</select>
				</label>
				<label class="flex items-center justify-between gap-2 text-sm">
					Reminders around
					<select name="reminderHour" class="rounded-lg border-2 border-stone-200 px-2 py-1.5">
						{#each [7, 8, 9, 10, 18, 19, 20] as hour (hour)}
							<option value={hour} selected={household.reminderHour === hour}>
								{hour}:00
							</option>
						{/each}
					</select>
				</label>
				{#if form?.savedHousehold === household.id}
					<p class="text-sm text-accent-700">Saved ✓</p>
				{/if}
				<button class="rounded-xl bg-accent-600 py-2 text-sm font-semibold text-white">
					Save
				</button>
			</form>
		</details>
	{/each}
</div>

<!-- Password -->
<details class="mb-3 rounded-2xl bg-white shadow-sm">
	<summary
		class="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium"
	>
		<KeyRound size={15} class="text-stone-500" /> Change password
	</summary>
	<form method="post" action="?/changePassword" use:enhance class="flex flex-col gap-3 p-4 pt-0">
		<input
			type="password"
			name="current"
			placeholder="Current password"
			autocomplete="current-password"
			required
			class="rounded-xl border-2 border-stone-200 px-3 py-2 focus:border-accent-500 focus:outline-none"
		/>
		<input
			type="password"
			name="new"
			placeholder="New password"
			autocomplete="new-password"
			required
			class="rounded-xl border-2 border-stone-200 px-3 py-2 focus:border-accent-500 focus:outline-none"
		/>
		<input
			type="password"
			name="confirm"
			placeholder="Repeat new password"
			autocomplete="new-password"
			required
			class="rounded-xl border-2 border-stone-200 px-3 py-2 focus:border-accent-500 focus:outline-none"
		/>
		{#if form?.passwordMessage}
			<p class="text-sm text-red-600">{form.passwordMessage}</p>
		{:else if form?.passwordChanged}
			<p class="text-sm text-accent-700">Password changed ✓</p>
		{/if}
		<button class="rounded-xl bg-accent-600 py-2 text-sm font-semibold text-white">
			Update password
		</button>
	</form>
</details>

<form method="post" action="/logout" use:enhance>
	<button
		class="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-stone-200
			py-3 text-sm font-medium text-stone-500"
	>
		<LogOut size={15} /> Sign out
	</button>
</form>
