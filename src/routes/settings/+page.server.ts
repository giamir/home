import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { hash, verify } from '@node-rs/argon2';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { households, users } from '$lib/server/db/schema';

const TIMEZONES = [
	'Europe/Rome',
	'Europe/Berlin',
	'Europe/London',
	'Europe/Madrid',
	'Europe/Paris',
	'Europe/Zurich'
];

export const load: PageServerLoad = async () => {
	return { timezones: TIMEZONES };
};

export const actions: Actions = {
	updateHousehold: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('householdId'));
		const name = String(form.get('name') ?? '').trim();
		const emoji = String(form.get('emoji') ?? '').trim() || '🏠';
		const timezone = String(form.get('timezone') ?? 'Europe/Berlin');
		const reminderHour = Math.min(23, Math.max(0, Number(form.get('reminderHour')) || 8));
		if (!name || !Number.isInteger(id)) return fail(400, { message: 'Name required' });
		await db
			.update(households)
			.set({ name, emoji, timezone, reminderHour })
			.where(eq(households.id, id));
		return { savedHousehold: id };
	},

	changePassword: async ({ request, locals }) => {
		const form = await request.formData();
		const current = String(form.get('current') ?? '');
		const next = String(form.get('new') ?? '');
		const confirm = String(form.get('confirm') ?? '');
		if (next.length < 6) {
			return fail(400, { passwordMessage: 'New password must be at least 6 characters' });
		}
		if (next !== confirm) {
			return fail(400, { passwordMessage: "New passwords don't match" });
		}
		const [user] = await db.select().from(users).where(eq(users.id, locals.user!.id));
		if (!user || !(await verify(user.passwordHash, current))) {
			return fail(400, { passwordMessage: 'Current password is wrong' });
		}
		await db
			.update(users)
			.set({ passwordHash: await hash(next, { memoryCost: 19456, timeCost: 2, parallelism: 1 }) })
			.where(eq(users.id, user.id));
		return { passwordChanged: true };
	}
};
