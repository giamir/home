import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { households } from '$lib/server/db/schema';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) return { user: null, households: [] };
	return {
		user: locals.user,
		households: await db.select().from(households).orderBy(households.id)
	};
};
