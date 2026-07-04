import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { areas, completions, households, tasks, users } from '$lib/server/db/schema';
import {
	computeStreak,
	coveringCounts,
	onTimeRate,
	weeklyHistory,
	weeklyScore
} from '$lib/server/gamification';
import { completionLocalDate } from '$lib/server/tasks';
import { localToday } from '$lib/dates';

const HISTORY_DAYS = 12 * 7;

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const allHouseholds = await db.select().from(households).orderBy(households.id);
	const household =
		allHouseholds.find((h) => h.id === user.currentHouseholdId) ?? allHouseholds[0];
	const timezone = household?.timezone ?? 'Europe/Berlin';
	const today = localToday(timezone);

	const allUsers = await db
		.select({ id: users.id, displayName: users.displayName, emoji: users.emoji })
		.from(users)
		.orderBy(users.id);

	const rows = await db
		.select({
			completion: completions,
			taskTitle: tasks.title,
			areaName: areas.name,
			householdId: areas.householdId
		})
		.from(completions)
		.innerJoin(tasks, eq(completions.taskId, tasks.id))
		.innerJoin(areas, eq(tasks.areaId, areas.id))
		.where(gte(completions.completedAt, new Date(Date.now() - HISTORY_DAYS * 86_400_000)));

	const enriched = rows.map((r) => ({
		...r.completion,
		localDate: completionLocalDate(r.completion.completedAt, timezone),
		taskTitle: r.taskTitle,
		areaName: r.areaName,
		householdId: r.householdId
	}));

	const activity = [...enriched]
		.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
		.slice(0, 20)
		.map((c) => ({
			id: c.id,
			userId: c.userId,
			taskTitle: c.taskTitle,
			areaName: c.areaName,
			houseEmoji: allHouseholds.find((h) => h.id === c.householdId)?.emoji ?? '',
			pointsAwarded: c.pointsAwarded,
			covered: c.coveredForUserId !== null,
			localDate: c.localDate,
			completedAt: c.completedAt
		}));

	// Per-user on-time rate
	const onTimeByUser: Record<number, number | null> = {};
	for (const u of allUsers) {
		onTimeByUser[u.id] = onTimeRate(enriched.filter((c) => c.userId === u.id));
	}

	// Points per house (last 30 days)
	const monthAgo = new Date(Date.now() - 30 * 86_400_000);
	const byHouse: Record<number, number> = {};
	const byArea: Record<string, number> = {};
	for (const c of enriched) {
		if (c.completedAt < monthAgo) continue;
		byHouse[c.householdId] = (byHouse[c.householdId] ?? 0) + c.pointsAwarded;
		const houseEmoji = allHouseholds.find((h) => h.id === c.householdId)?.emoji ?? '';
		const key = `${houseEmoji} ${c.areaName}`;
		byArea[key] = (byArea[key] ?? 0) + c.pointsAwarded;
	}
	const topAreas = Object.entries(byArea)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8);

	// Current streaks across both houses
	const recurringTasks = await db
		.select({
			id: tasks.id,
			title: tasks.title,
			nextDueDate: tasks.nextDueDate,
			areaName: areas.name,
			householdId: areas.householdId
		})
		.from(tasks)
		.innerJoin(areas, eq(tasks.areaId, areas.id))
		.where(and(eq(tasks.isRecurring, true), isNull(tasks.archivedAt), isNull(areas.archivedAt)));
	const streaks: { title: string; house: string; streak: number }[] = [];
	if (recurringTasks.length > 0) {
		const history = await db
			.select({ taskId: completions.taskId, onTime: completions.onTime })
			.from(completions)
			.where(
				inArray(
					completions.taskId,
					recurringTasks.map((t) => t.id)
				)
			)
			.orderBy(desc(completions.completedAt))
			.limit(500);
		for (const task of recurringTasks) {
			const flags = history.filter((h) => h.taskId === task.id).map((h) => h.onTime);
			const houseTz =
				allHouseholds.find((h) => h.id === task.householdId)?.timezone ?? timezone;
			const overdue = task.nextDueDate !== null && task.nextDueDate < localToday(houseTz);
			const streak = computeStreak(flags, overdue);
			if (streak > 1) {
				streaks.push({
					title: task.title,
					house: allHouseholds.find((h) => h.id === task.householdId)?.emoji ?? '',
					streak
				});
			}
		}
		streaks.sort((a, b) => b.streak - a.streak);
	}

	return {
		allUsers,
		activity,
		today,
		thisWeek: weeklyScore(enriched, today),
		history: weeklyHistory(enriched).slice(0, 8),
		covering: coveringCounts(enriched),
		onTimeByUser,
		byHouse,
		topAreas,
		streaks: streaks.slice(0, 6),
		housesById: Object.fromEntries(allHouseholds.map((h) => [h.id, h]))
	};
};
