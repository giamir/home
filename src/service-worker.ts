/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

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
				await existing.focus();
				existing.navigate(url);
			} else {
				await sw.clients.openWindow(url);
			}
		})
	);
});

sw.addEventListener('pushsubscriptionchange', ((event: Event) => {
	// Best-effort resubscribe (spotty support on iOS; expired subscriptions
	// are cleaned up server-side on 410s either way)
	const change = event as Event & {
		oldSubscription?: PushSubscription | null;
		waitUntil(promise: Promise<unknown>): void;
	};
	change.waitUntil(
		sw.registration.pushManager
			.subscribe({
				userVisibleOnly: true,
				applicationServerKey: change.oldSubscription?.options.applicationServerKey ?? undefined
			})
			.then((subscription) =>
				fetch('/api/push/subscribe', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(subscription.toJSON())
				})
			)
			.catch(() => {})
	);
}) as EventListener);
