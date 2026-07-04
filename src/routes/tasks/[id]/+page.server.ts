import { desc, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { areas, completions, households, tasks, users } from '$lib/server/db/schema';
import { computeStreak } from '$lib/server/gamification';
import { completionLocalDate } from '$lib/server/tasks';
import { daysBetween, localToday } from '$lib/dates';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const [row] = await db
		.select({ task: tasks, area: areas, household: households })
		.from(tasks)
		.innerJoin(areas, eq(tasks.areaId, areas.id))
		.innerJoin(households, eq(areas.householdId, households.id))
		.where(eq(tasks.id, id));
	if (!row) error(404, 'Task not found');

	const today = localToday(row.household.timezone);

	const history = await db
		.select({
			id: completions.id,
			completedAt: completions.completedAt,
			onTime: completions.onTime,
			pointsAwarded: completions.pointsAwarded,
			coveredForUserId: completions.coveredForUserId,
			userId: users.id,
			userName: users.displayName,
			userEmoji: users.emoji
		})
		.from(completions)
		.innerJoin(users, eq(completions.userId, users.id))
		.where(eq(completions.taskId, id))
		.orderBy(desc(completions.completedAt))
		.limit(50);

	const allUsers = await db
		.select({ id: users.id, displayName: users.displayName, emoji: users.emoji })
		.from(users)
		.orderBy(users.id);

	const byUser: Record<number, { count: number; points: number }> = {};
	for (const c of history) {
		byUser[c.userId] ??= { count: 0, points: 0 };
		byUser[c.userId].count++;
		byUser[c.userId].points += c.pointsAwarded;
	}

	// Average days between completions (distinct local dates, newest first)
	const dates = [
		...new Set(history.map((c) => completionLocalDate(c.completedAt, row.household.timezone)))
	];
	let avgIntervalDays: number | null = null;
	if (dates.length >= 2) {
		const gaps = dates.slice(0, -1).map((d, i) => daysBetween(dates[i + 1], d));
		avgIntervalDays = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
	}

	const overdue = row.task.nextDueDate !== null && row.task.nextDueDate < today;
	const streak = row.task.isRecurring
		? computeStreak(history.map((c) => c.onTime), overdue)
		: 0;

	return {
		task: row.task,
		area: row.area,
		household: row.household,
		history: history.map((c) => ({
			...c,
			localDate: completionLocalDate(c.completedAt, row.household.timezone)
		})),
		allUsers,
		byUser,
		avgIntervalDays,
		streak,
		today
	};
};
