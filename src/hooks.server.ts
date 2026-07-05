import { error, redirect, type Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	deleteSessionTokenCookie,
	setSessionTokenCookie,
	validateSessionToken
} from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Cron authenticates with CRON_SECRET, not a session
	if (pathname.startsWith('/api/cron/')) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const { session, user } = await validateSessionToken(token);
		if (session) {
			setSessionTokenCookie(event, token, session.expiresAt);
		} else {
			deleteSessionTokenCookie(event);
		}
		event.locals.session = session;
		event.locals.user = user;
	} else {
		event.locals.session = null;
		event.locals.user = null;
	}

	if (!event.locals.user && pathname !== '/login') {
		// APIs must fail loudly: a 302 to the login page reads as a 200 to
		// fetch() callers like the service worker's push resubscribe.
		if (pathname.startsWith('/api/')) error(401);
		redirect(302, '/login');
	}
	if (event.locals.user && pathname === '/login') {
		redirect(302, '/');
	}

	return resolve(event);
};
