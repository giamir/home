// Client-side push helpers, shared by the app and the service worker.
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';

export function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
	const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
	const bytes = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
	return bytes;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/**
 * Re-register this device's current push subscription with the server. The
 * subscribe endpoint upserts on the endpoint URL, so this is idempotent —
 * calling it on every app open self-heals subscriptions the server pruned
 * (after 404/410 send failures) and pushsubscriptionchange re-registrations
 * that failed, both of which otherwise lose reminders silently.
 */
export async function syncPushSubscription(): Promise<'on' | 'off' | 'error'> {
	try {
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'off';
		const registration = await navigator.serviceWorker.ready;
		let subscription = await registration.pushManager.getSubscription();
		if (!subscription) return 'off';

		// A subscription made with a different (since-rotated) VAPID key can
		// never be pushed to again and blocks resubscribing — replace it.
		const wantedKey = base64ToUint8Array(PUBLIC_VAPID_PUBLIC_KEY);
		const currentKey = subscription.options.applicationServerKey;
		if (currentKey && !bytesEqual(new Uint8Array(currentKey), wantedKey)) {
			await subscription.unsubscribe();
			subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: wantedKey
			});
		}

		let response: Response;
		try {
			response = await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(subscription.toJSON())
			});
		} catch {
			// Network hiccup — the local subscription itself is still fine.
			return 'on';
		}
		// An expired session answers 401 (or, defensively, a redirect).
		return response.ok && !response.redirected ? 'on' : 'error';
	} catch (error) {
		console.error('Push subscription sync failed:', error);
		return 'error';
	}
}
