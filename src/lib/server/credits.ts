import { gte } from 'drizzle-orm';
import { db } from './db';
import { credits } from './db/schema';

/** Mental-load credit: noticing and planning is work too. */
export async function addCredit(userId: number, points: number, reason: 'noticed' | 'review') {
	try {
		await db.insert(credits).values({ userId, points, reason });
	} catch (error) {
		console.error('Credit insert failed:', error);
	}
}

export async function getCreditsSince(cutoff: Date) {
	return db.select().from(credits).where(gte(credits.createdAt, cutoff));
}
