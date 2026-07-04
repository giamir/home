<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { House, LayoutGrid, ChartBar, Settings } from '@lucide/svelte';

	let { children, data } = $props();

	const tabs = [
		{ href: '/', label: 'Today', icon: House },
		{ href: '/areas', label: 'Areas', icon: LayoutGrid },
		{ href: '/stats', label: 'Stats', icon: ChartBar },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];

	function isActive(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if data?.user}
	<div class="mx-auto flex min-h-dvh max-w-lg flex-col">
		<main class="flex-1 px-4 pt-4 pb-24">
			{@render children()}
		</main>

		<nav
			class="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/90 backdrop-blur"
			style="padding-bottom: env(safe-area-inset-bottom)"
		>
			<div class="mx-auto flex max-w-lg">
				{#each tabs as tab (tab.href)}
					<a
						href={tab.href}
						class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium
							{isActive(tab.href) ? 'text-accent-600' : 'text-stone-500'}"
					>
						<tab.icon size={22} strokeWidth={isActive(tab.href) ? 2.5 : 2} />
						{tab.label}
					</a>
				{/each}
			</div>
		</nav>
	</div>
{:else}
	{@render children()}
{/if}
