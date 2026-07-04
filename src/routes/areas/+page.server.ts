import { and, eq, isNull } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { areas, households, tasks, users } from '$lib/server/db/schema';
import { localToday } from '$lib/dates';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const allHouseholds = await db.select().from(households).orderBy(households.id);
	const currentId = user.currentHouseholdId ?? allHouseholds[0]?.id;
	const viewId = Number(url.searchParams.get('house')) || currentId;
	const household = allHouseholds.find((h) => h.id === viewId) ?? allHouseholds[0];
	const today = localToday(household.timezone);

	const areaRows = await db
		.select()
		.from(areas)
		.where(and(eq(areas.householdId, household.id), isNull(areas.archivedAt)))
		.orderBy(areas.sortOrder, areas.id);

	const openTasks = await db
		.select({ id: tasks.id, areaId: tasks.areaId, nextDueDate: tasks.nextDueDate })
		.from(tasks)
		.innerJoin(areas, eq(tasks.areaId, areas.id))
		.where(and(eq(areas.householdId, household.id), isNull(tasks.archivedAt)));

	const dueCounts: Record<number, number> = {};
	for (const t of openTasks) {
		if (t.nextDueDate !== null && t.nextDueDate <= today) {
			dueCounts[t.areaId] = (dueCounts[t.areaId] ?? 0) + 1;
		}
	}

	return {
		household,
		areas: areaRows,
		dueCounts,
		allUsers: await db
			.select({ id: users.id, displayName: users.displayName, emoji: users.emoji })
			.from(users)
			.orderBy(users.id)
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const householdId = Number(form.get('householdId'));
		const icon = String(form.get('icon') ?? 'house');
		const owner = form.get('ownerUserId');
		if (!name || !Number.isInteger(householdId)) return fail(400, { message: 'Name required' });

		const [area] = await db
			.insert(areas)
			.values({
				name,
				householdId,
				icon,
				ownerUserId: owner ? Number(owner) : null,
				sortOrder: 999
			})
			.returning();
		redirect(303, `/areas/${area.id}`);
	}
};
