import { error, json } from '@sveltejs/kit';
import { and, eq, isNotNull, isNull, lte, or, ne } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { areas, households, tasks, users } from '$lib/server/db/schema';
import { resolveReminderTargets } from '$lib/server/reminders';
import { sendPushToUser } from '$lib/server/push';
import { daysBetween, localToday } from '$lib/dates';

export const GET: RequestHandler = async ({ request }) => {
	if (!env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
		error(401);
	}

	const [allHouseholds, allUsers] = await Promise.all([
		db.select().from(households),
		db.select({ id: users.id, currentHouseholdId: users.currentHouseholdId }).from(users)
	]);

	let sent = 0;
	for (const household of allHouseholds) {
		const today = localToday(household.timezone);

		const dueTasks = await db
			.select({ task: tasks, area: areas })
			.from(tasks)
			.innerJoin(areas, eq(tasks.areaId, areas.id))
			.where(
				and(
					eq(areas.householdId, household.id),
					isNull(tasks.archivedAt),
					isNull(areas.archivedAt),
					isNotNull(tasks.nextDueDate),
					lte(tasks.nextDueDate, today),
					or(isNull(tasks.lastRemindedOn), ne(tasks.lastRemindedOn, today))
				)
			);

		for (const { task, area } of dueTasks) {
			const targets = resolveReminderTargets(
				{
					assignedUserId: task.assignedUserId,
					areaOwnerUserId: area.ownerUserId,
					remindWhenAway: task.remindWhenAway,
					householdId: household.id
				},
				allUsers
			);
			if (targets.length === 0) continue;

			const overdueDays = -daysBetween(today, task.nextDueDate!);
			const body =
				overdueDays > 0
					? `${area.name} · ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`
					: `${area.name} · due today`;

			for (const userId of targets) {
				await sendPushToUser(userId, {
					title: `${household.emoji} ${household.name}: ${task.title}`,
					body,
					url: `/areas/${area.id}`
				});
				sent++;
			}
			await db.update(tasks).set({ lastRemindedOn: today }).where(eq(tasks.id, task.id));
		}
	}

	return json({ sent });
};
