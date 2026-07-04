<script lang="ts">
	import { onMount } from 'svelte';
	import { Bell, BellOff, BellRing, Share, SquarePlus } from '@lucide/svelte';
	import { env } from '$env/dynamic/public';

	type Status =
		| 'loading'
		| 'unsupported'
		| 'not-installed'
		| 'denied'
		| 'off'
		| 'on'
		| 'error';

	let status = $state<Status>('loading');
	let busy = $state(false);

	onMount(async () => {
		const standalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);

		if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
			// On iOS the push APIs only exist inside an installed (home screen) PWA
			const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
			status = isIos && !standalone ? 'not-installed' : 'unsupported';
			return;
		}
		if (Notification.permission === 'denied') {
			status = 'denied';
			return;
		}
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		status = subscription ? 'on' : 'off';
	});

	function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
		const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
		const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
		const bytes = new Uint8Array(new ArrayBuffer(raw.length));
		for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
		return bytes;
	}

	async function enable() {
		busy = true;
		try {
			// Permission must be requested inside the tap gesture on iOS
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				status = permission === 'denied' ? 'denied' : 'off';
				return;
			}
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: base64ToUint8Array(env.PUBLIC_VAPID_PUBLIC_KEY ?? '')
			});
			const response = await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(subscription.toJSON())
			});
			status = response.ok ? 'on' : 'error';
		} catch (error) {
			console.error('Push subscribe failed:', error);
			status = 'error';
		} finally {
			busy = false;
		}
	}

	async function disable() {
		busy = true;
		try {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.getSubscription();
			if (subscription) {
				await fetch('/api/push/subscribe', {
					method: 'DELETE',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ endpoint: subscription.endpoint })
				});
				await subscription.unsubscribe();
			}
			status = 'off';
		} finally {
			busy = false;
		}
	}
</script>

<div class="rounded-2xl bg-white p-4 shadow-sm">
	<h2 class="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-500">
		<Bell size={15} /> Reminders
	</h2>

	{#if status === 'loading'}
		<p class="text-sm text-stone-400">Checking…</p>
	{:else if status === 'not-installed'}
		<p class="text-sm text-stone-600">
			To get reminders on your iPhone, first add this app to your home screen:
		</p>
		<ol class="mt-2 flex flex-col gap-1 text-sm text-stone-500">
			<li class="flex items-center gap-1.5">
				1. Tap <Share size={15} class="inline text-sky-600" /> in Safari
			</li>
			<li class="flex items-center gap-1.5">
				2. Choose <SquarePlus size={15} class="inline" /> “Add to Home Screen”
			</li>
			<li>3. Open the app from your home screen and come back here</li>
		</ol>
	{:else if status === 'unsupported'}
		<p class="text-sm text-stone-500">This browser doesn't support push notifications.</p>
	{:else if status === 'denied'}
		<p class="text-sm text-stone-500">
			Notifications are blocked. Enable them in Settings → Notifications → Home.
		</p>
	{:else if status === 'on'}
		<p class="mb-3 flex items-center gap-1.5 text-sm text-accent-700">
			<BellRing size={15} /> Reminders are on for this device.
		</p>
		<button
			onclick={disable}
			disabled={busy}
			class="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-stone-200
				py-2 text-sm font-medium disabled:opacity-50"
		>
			<BellOff size={15} /> Turn off on this device
		</button>
	{:else}
		{#if status === 'error'}
			<p class="mb-2 text-sm text-red-600">Something went wrong — try again.</p>
		{/if}
		<p class="mb-3 text-sm text-stone-600">
			Get a nudge when chores are due and a cheer when your partner finishes one.
		</p>
		<button
			onclick={enable}
			disabled={busy}
			class="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 py-2.5
				font-semibold text-white disabled:opacity-50"
		>
			<BellRing size={16} />
			{busy ? 'Enabling…' : 'Enable reminders'}
		</button>
	{/if}
</div>
