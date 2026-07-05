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
 * The Vercel cron pings this endpoint hourly. Each household only gets pushes
 * during its waking window (reminderHour .. QUIET_FROM local time), and a
 * still-not-done task is re-nudged at most every REMIND_GAP_HOURS — with the
 * default 08:00 reminderHour that works out to a morning and an evening nudge
 * (~08:00 and ~18:00 local) in any season or timezone. Fixed UTC schedules
 * used to skip the morning nudge whenever DST shifted it before reminderHour.
 */
const REMIND_GAP_HOURS = 10;
// The gap is exactly two cron ticks, and lastRemindedAt is written after the
// sends — without slack, cron jitter makes the second nudge race the boundary
// and lose (for reminderHour 10 that would drop the evening nudge outright).
const REMIND_GAP_SLACK_MINUTES = 30;
const QUIET_FROM = 21;

export const GET: RequestHandler = async ({ request }) => {
	if (!env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
		error(401);
	}

	const allHouseholds = await db.select().from(households);
	const activeHouseholds = allHouseholds.filter((h) => {
		const hour = localHour(h.timezone);
		return hour >= h.reminderHour && hour < QUIET_FROM;
	});
	// Overnight the hourly cron has nothing to do — skip the users query too.
	if (activeHouseholds.length === 0) return json({ sent: 0 });

	const allUsers = await db
		.select({ id: users.id, currentHouseholdId: users.currentHouseholdId })
		.from(users);

	let sent = 0;
	for (const household of activeHouseholds) {
		const today = localToday(household.timezone);
		const gapCutoff = new Date(
			Date.now() - (REMIND_GAP_HOURS * 60 - REMIND_GAP_SLACK_MINUTES) * 60_000
		);

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
