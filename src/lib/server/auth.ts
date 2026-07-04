import { randomBytes, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from './db';
import { sessions, users } from './db/schema';

const DAY_MS = 86_400_000;
const SESSION_LIFETIME_MS = 30 * DAY_MS;
const RENEWAL_THRESHOLD_MS = 15 * DAY_MS;

export const SESSION_COOKIE = 'session';

export function generateSessionToken(): string {
	return randomBytes(20).toString('base64url');
}

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function createSession(token: string, userId: number) {
	const session = {
		id: hashToken(token),
		userId,
		expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS)
	};
	await db.insert(sessions).values(session);
	return session;
}

export async function validateSessionToken(token: string) {
	const sessionId = hashToken(token);
	const [row] = await db
		.select({ session: sessions, user: users })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId));

	if (!row) return { session: null, user: null };

	if (Date.now() >= row.session.expiresAt.getTime()) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
		return { session: null, user: null };
	}

	if (Date.now() >= row.session.expiresAt.getTime() - RENEWAL_THRESHOLD_MS) {
		row.session.expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
		await db
			.update(sessions)
			.set({ expiresAt: row.session.expiresAt })
			.where(eq(sessions.id, sessionId));
	}

	const { passwordHash: _, ...user } = row.user;
	return { session: row.session, user };
}

export async function invalidateSession(sessionId: string) {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date) {
	event.cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', expires: expiresAt });
}

export function deleteSessionTokenCookie(event: RequestEvent) {
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
}
