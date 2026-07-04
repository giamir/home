import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

export const actions: Actions = {
	// Updates where the current user is staying ("I'm at Helga now")
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const householdId = Number(form.get('householdId'));
		const redirectTo = String(form.get('redirectTo') ?? '/');
		if (locals.user && Number.isInteger(householdId)) {
			await db
				.update(users)
				.set({ currentHouseholdId: householdId })
				.where(eq(users.id, locals.user.id));
		}
		redirect(302, redirectTo.startsWith('/') ? redirectTo : '/');
	}
};
