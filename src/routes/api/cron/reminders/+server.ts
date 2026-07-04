import { error, json } from '@sveltejs/kit';
import { and, eq, isNotNull, isNull, lt, lte, or } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { areas, households, tasks, users } from '$lib/server/db/schema';
import { resolveReminderTargets } from '$lib/server/reminders';
import { sendPushToUser } from '$lib/server/push';
import { reminderBody } from '$lib/server/push-copy';
import { daysBetween, localHour, localToday } from '$lib/dates';

/**
 * A still-not-done task is re-nudged at most every REMIND_GAP_HOURS, and only
 * during the household's waking window (reminderHour .. QUIET_FROM local
 * time). With the two daily Vercel cron runs this means a morning and an
 * evening nudge; pinging the endpoint more often (manually or via an external
 * scheduler) escalates gracefully without night-time or rapid-fire spam.
 */
const REMIND_GAP_HOURS = 5;
const QUIET_FROM = 21;

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
		const hour = localHour(household.timezone);
		if (hour < household.reminderHour || hour >= QUIET_FROM) continue;

		const today = localToday(household.timezone);
		const gapCutoff = new Date(Date.now() - REMIND_GAP_HOURS * 3_600_000);

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
					or(isNull(tasks.lastRemindedAt), lt(tasks.lastRemindedAt, gapCutoff))
				)
			);

		for (const { task, area } of dueTasks) {
			const targets = resolveReminderTargets(
				{
					// Rotation turn acts as the assignee for targeting
					assignedUserId: task.assignedUserId ?? (task.rotate ? task.nextTurnUserId : null),
					areaOwnerUserId: area.ownerUserId,
					remindWhenAway: task.remindWhenAway,
					householdId: household.id
				},
				allUsers
			);
			if (targets.length === 0) continue;

			const overdueDays = -daysBetween(today, task.nextDueDate!);
			const body = reminderBody(area.name, overdueDays, task.lastRemindedAt !== null);

			for (const userId of targets) {
				await sendPushToUser(userId, {
					title: `${household.emoji} ${household.name}: ${task.title}`,
					body,
					url: `/areas/${area.id}`
				});
				sent++;
			}
			await db.update(tasks).set({ lastRemindedAt: new Date() }).where(eq(tasks.id, task.id));
		}
	}

	return json({ sent });
};
