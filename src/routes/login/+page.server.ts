import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { verify } from '@node-rs/argon2';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createSession, generateSessionToken, setSessionTokenCookie } from '$lib/server/auth';

export const load: PageServerLoad = async () => {
	return {
		accounts: await db
			.select({ username: users.username, displayName: users.displayName, emoji: users.emoji })
			.from(users)
			.orderBy(users.id)
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const username = form.get('username');
		const password = form.get('password');
		if (typeof username !== 'string' || typeof password !== 'string' || !password) {
			return fail(400, { username: String(username ?? ''), message: 'Enter your password' });
		}

		const [user] = await db.select().from(users).where(eq(users.username, username));
		if (!user || !(await verify(user.passwordHash, password))) {
			return fail(400, { username, message: 'Wrong password, try again' });
		}

		const token = generateSessionToken();
		const session = await createSession(token, user.id);
		setSessionTokenCookie(event, token, session.expiresAt);
		redirect(302, '/');
	}
};
