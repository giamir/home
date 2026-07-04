import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { pushSubscriptions } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);
	const body = await request.json();
	const { endpoint, keys } = body ?? {};
	if (typeof endpoint !== 'string' || !keys?.p256dh || !keys?.auth) {
		error(400, 'Invalid subscription');
	}

	await db
		.insert(pushSubscriptions)
		.values({ userId: locals.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth })
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: { userId: locals.user.id, p256dh: keys.p256dh, auth: keys.auth }
		});

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);
	const { endpoint } = await request.json();
	if (typeof endpoint !== 'string') error(400);
	await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
	return json({ ok: true });
};
