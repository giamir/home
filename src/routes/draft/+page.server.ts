import { and, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { areas, households, tasks, users } from '$lib/server/db/schema';
import { addToDate, localToday } from '$lib/dates';

/** Draftable pool: current house, due within the next 7 days (incl. overdue). */
async function loadPool(householdId: number, timezone: string) {
	const today = localToday(timezone);
	return db
		.select({
			id: tasks.id,
			title: tasks.title,
			points: tasks.points,
			estimatedMinutes: tasks.estimatedMinutes,
			dread: tasks.dread,
			nextDueDate: tasks.nextDueDate,
			assignedUserId: tasks.assignedUserId,
			areaName: areas.name
		})
		.from(tasks)
		.innerJoin(areas, eq(tasks.areaId, areas.id))
		.where(
			and(
				eq(areas.householdId, householdId),
				isNull(tasks.archivedAt),
				isNull(areas.archivedAt),
				isNotNull(tasks.nextDueDate),
				lte(tasks.nextDueDate, addToDate(today, 7, 'day'))
			)
		);
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const allHouseholds = await db.select().from(households).orderBy(households.id);
	const household =
		allHouseholds.find((h) => h.id === user.currentHouseholdId) ?? allHouseholds[0];

	const [pool, allUsers] = await Promise.all([
		loadPool(household.id, household.timezone),
		db
			.select({ id: users.id, displayName: users.displayName, emoji: users.emoji })
			.from(users)
			.orderBy(users.id)
	]);

	return {
		household,
		pool: pool.sort((a, b) => b.estimatedMinutes - a.estimatedMinutes),
		allUsers
	};
};

export const actions: Actions = {
	pick: async ({ request }) => {
		const form = await request.formData();
		const taskId = Number(form.get('taskId'));
		const userId = Number(form.get('userId'));
		if (!Number.isInteger(taskId) || !Number.isInteger(userId)) return fail(400);
		await db.update(tasks).set({ assignedUserId: userId }).where(eq(tasks.id, taskId));
		return {};
	},

	reset: async ({ request, locals }) => {
		const user = locals.user!;
		const allHouseholds = await db.select().from(households).orderBy(households.id);
		const household =
			allHouseholds.find((h) => h.id === user.currentHouseholdId) ?? allHouseholds[0];
		const pool = await loadPool(household.id, household.timezone);
		if (pool.length > 0) {
			await db
				.update(tasks)
				.set({ assignedUserId: null })
				.where(
					inArray(
						tasks.id,
						pool.map((t) => t.id)
					)
				);
		}
		return {};
	}
};
