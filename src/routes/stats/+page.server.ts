import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { areas, completions, households, tasks, users } from '$lib/server/db/schema';
import {
	computeStreak,
	coveringCounts,
	onTimeRate,
	teamLevel as computeTeamLevel,
	weeklyHistory,
	weeklyScore
} from '$lib/server/gamification';
import { completionLocalDate } from '$lib/server/tasks';
import { localHour, localToday } from '$lib/dates';

const HISTORY_DAYS = 12 * 7;

/** The single user strictly ahead in `counts`, or null on a tie / all-zero. */
function topUser(counts: Record<number, number>): number | null {
	const entries = Object.entries(counts).filter(([, n]) => n > 0);
	if (entries.length === 0) return null;
	entries.sort((a, b) => b[1] - a[1]);
	if (entries.length > 1 && entries[0][1] === entries[1][1]) return null;
	return Number(entries[0][0]);
}

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

	const thisWeek = weeklyScore(enriched, today);
	const history = weeklyHistory(enriched);

	// Team level: all-time points, shared — it only ever grows
	const [allTime] = await db
		.select({
			count: sql<number>`count(*)::int`,
			points: sql<number>`coalesce(sum(points_awarded), 0)::int`
		})
		.from(completions);
	const teamLevel = {
		...computeTeamLevel(allTime.points),
		totalPoints: allTime.points,
		totalChores: allTime.count
	};

	// Weekly team goal: beat your own 4-week average (self-tuning, no config)
	const pastWeeks = history.filter((w) => w.weekStart !== thisWeek.weekStart).slice(0, 4);
	const weeklyGoal =
		pastWeeks.length > 0
			? Math.max(
					50,
					Math.round(pastWeeks.reduce((sum, w) => sum + w.team, 0) / pastWeeks.length / 10) * 10
				)
			: 100;

	// This week's superlatives
	const weekCompletions = enriched.filter((c) => c.localDate >= thisWeek.weekStart);
	const counters = {
		morning: {} as Record<number, number>,
		evening: {} as Record<number, number>,
		covers: {} as Record<number, number>
	};
	for (const c of weekCompletions) {
		const hour = localHour(timezone, c.completedAt);
		if (hour < 12) counters.morning[c.userId] = (counters.morning[c.userId] ?? 0) + 1;
		if (hour >= 18) counters.evening[c.userId] = (counters.evening[c.userId] ?? 0) + 1;
		if (c.coveredForUserId !== null && c.coveredForUserId !== c.userId) {
			counters.covers[c.userId] = (counters.covers[c.userId] ?? 0) + 1;
		}
	}
	// Hottest area of the week, and its champion
	const areaPoints: Record<string, number> = {};
	for (const c of weekCompletions) {
		areaPoints[c.areaName] = (areaPoints[c.areaName] ?? 0) + c.pointsAwarded;
	}
	const hottestArea = Object.entries(areaPoints).sort((a, b) => b[1] - a[1])[0]?.[0];
	const areaChampCounts: Record<number, number> = {};
	if (hottestArea) {
		for (const c of weekCompletions) {
			if (c.areaName === hottestArea) {
				areaChampCounts[c.userId] = (areaChampCounts[c.userId] ?? 0) + c.pointsAwarded;
			}
		}
	}

	const highlights: { emoji: string; title: string; userId: number }[] = [];
	const earlyBird = topUser(counters.morning);
	if (earlyBird !== null) highlights.push({ emoji: '🌅', title: 'Early bird', userId: earlyBird });
	const nightOwl = topUser(counters.evening);
	if (nightOwl !== null) highlights.push({ emoji: '🦉', title: 'Night owl', userId: nightOwl });
	const teammate = topUser(counters.covers);
	if (teammate !== null)
		highlights.push({ emoji: '💚', title: 'Best teammate', userId: teammate });
	const champion = topUser(areaChampCounts);
	if (champion !== null && hottestArea)
		highlights.push({ emoji: '🏆', title: `${hottestArea} hero`, userId: champion });

	// Winner per past week, for the crown on the history rows
	const historyWithWinners = history.slice(0, 8).map((w) => ({ ...w, winnerId: topUser(w.byUser) }));

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
		const streakHistory = await db
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
			const flags = streakHistory.filter((h) => h.taskId === task.id).map((h) => h.onTime);
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

	return {
		allUsers,
		activity,
		today,
		thisWeek,
		teamLevel,
		weeklyGoal,
		highlights,
		history: historyWithWinners,
		covering: coveringCounts(enriched),
		onTimeByUser,
		byHouse,
		topAreas,
		streaks: streaks.slice(0, 6),
		housesById: Object.fromEntries(allHouseholds.map((h) => [h.id, h]))
	};
};
