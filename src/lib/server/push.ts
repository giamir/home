import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { pushSubscriptions } from './db/schema';

export interface PushPayload {
	title: string;
	body: string;
	url: string;
}

let configured = false;

function ensureConfigured(): boolean {
	if (configured) return true;
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
	webpush.setVapidDetails(
		env.VAPID_SUBJECT ?? 'mailto:giamir.buoncristiani@gmail.com',
		env.VAPID_PUBLIC_KEY,
		env.VAPID_PRIVATE_KEY
	);
	configured = true;
	return true;
}

/**
 * Send a notification to every registered device of a user. Expired
 * subscriptions (404/410) are deleted — this is the cleanup path for
 * subscriptions that iOS silently rotates or revokes.
 */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
	if (!ensureConfigured()) return;

	const subs = await db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId));

	await Promise.all(
		subs.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
					JSON.stringify(payload),
					{ TTL: 43_200 }
				);
			} catch (error) {
				const statusCode = (error as { statusCode?: number }).statusCode;
				if (statusCode === 404 || statusCode === 410) {
					await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
				} else {
					console.error(`Push to user ${userId} failed:`, error);
				}
			}
		})
	);
}
