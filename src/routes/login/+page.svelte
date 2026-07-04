<script lang="ts">
	import { enhance } from '$app/forms';
	import { LogIn } from '@lucide/svelte';

	let { data, form } = $props();

	let selected = $state(form?.username ?? '');
	let submitting = $state(false);
</script>

<svelte:head><title>Login · Home</title></svelte:head>

<div class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
	<div class="text-center">
		<div class="text-5xl">🏡</div>
		<h1 class="mt-3 text-2xl font-bold">Welcome home</h1>
		<p class="mt-1 text-sm text-stone-500">Who's this?</p>
	</div>

	<form
		method="post"
		class="flex flex-col gap-4"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				submitting = false;
				await update();
			};
		}}
	>
		<div class="grid grid-cols-2 gap-3">
			{#each data.accounts as account (account.username)}
				<label
					class="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 p-4
						{selected === account.username
						? 'border-accent-500 bg-accent-50'
						: 'border-stone-200 bg-white'}"
				>
					<input
						type="radio"
						name="username"
						value={account.username}
						bind:group={selected}
						class="sr-only"
						required
					/>
					<span class="text-4xl">{account.emoji}</span>
					<span class="font-semibold">{account.displayName}</span>
				</label>
			{/each}
		</div>

		{#if selected}
			<input
				type="password"
				name="password"
				placeholder="Password"
				autocomplete="current-password"
				required
				class="rounded-2xl border-2 border-stone-200 bg-white px-4 py-3 text-base
					focus:border-accent-500 focus:outline-none"
			/>

			{#if form?.message}
				<p class="text-center text-sm text-red-600">{form.message}</p>
			{/if}

			<button
				type="submit"
				disabled={submitting}
				class="flex items-center justify-center gap-2 rounded-2xl bg-accent-600 py-3
					font-semibold text-white disabled:opacity-50"
			>
				<LogIn size={18} />
				{submitting ? 'Signing in…' : 'Sign in'}
			</button>
		{/if}
	</form>
</div>
