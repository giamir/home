/// <reference types="@sveltejs/kit" />
/// <reference types="../.svelte-kit/ambient.d.ts" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
import { base64ToUint8Array } from '$lib/push-client';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `home-${version}`;
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);

	// Cache-first for immutable build assets; network for everything else
	// (stale chore data is worse than a spinner).
	if (url.origin === location.origin && ASSETS.includes(url.pathname)) {
		event.respondWith(
			caches.open(CACHE).then(async (cache) => {
				const cached = await cache.match(event.request);
				return cached ?? fetch(event.request);
			})
		);
		return;
	}

	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request).catch(
				() =>
					new Response(
						'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline</title></head>' +
							'<body style="font-family: system-ui; display: grid; place-items: center; min-height: 90vh; text-align: center; color: #57534e">' +
							'<div><div style="font-size: 3rem">📴</div><h1>You\'re offline</h1><p>Chores will still be there when you\'re back.</p></div></body></html>',
						{ status: 503, headers: { 'content-type': 'text/html' } }
					)
			)
		);
	}
});

sw.addEventListener('push', (event) => {
	// iOS requires every push to show a notification — no silent pushes
	let payload = { title: 'Home', body: '', url: '/' };
	try {
		payload = { ...payload, ...event.data?.json() };
	} catch {
		// keep defaults
	}
	event.waitUntil(
		sw.registration.showNotification(payload.title, {
			body: payload.body,
			data: { url: payload.url },
			icon: '/icons/icon-192.png',
			badge: '/icons/badge.png'
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = (event.notification.data?.url as string) ?? '/';
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
			const existing = clients[0];
			if (existing) {
				// focus() can be refused by the UA — that alone shouldn't
				// swallow the navigation.
				await existing.focus().catch(() => {});
				try {
					// navigate() rejects on clients this worker doesn't
					// control (e.g. a hard-reloaded page).
					await existing.navigate(url);
					return;
				} catch {
					// fall through to opening a fresh window
				}
			}
			await sw.clients.openWindow(url);
		})
	);
});

sw.addEventListener('pushsubscriptionchange', ((event: Event) => {
	// Resubscribe with our own VAPID key — oldSubscription is allowed to be
	// null (iOS rotates subscriptions exactly this way), so its key can't be
	// relied on. A failure here is recovered on the next app open, when the
	// layout re-syncs the current subscription with the server.
	const change = event as Event & { waitUntil(promise: Promise<unknown>): void };
	change.waitUntil(
		sw.registration.pushManager
			.subscribe({
				userVisibleOnly: true,
				applicationServerKey: base64ToUint8Array(PUBLIC_VAPID_PUBLIC_KEY)
			})
			.then((subscription) =>
				fetch('/api/push/subscribe', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(subscription.toJSON())
				})
			)
			.then((response) => {
				// An expired session answers 401 (or, defensively, a redirect).
				if (!response.ok || response.redirected)
					throw new Error(`subscribe endpoint returned ${response.status}`);
			})
			.catch((error) => console.error('pushsubscriptionchange resubscribe failed:', error))
	);
}) as EventListener);
