import { and, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	areas,
	checkins,
	completions,
	credits as creditsTable,
	households,
	tasks,
	users
} from '$lib/server/db/schema';
import { getCreditsSince } from '$lib/server/credits';
import { sendPushToUser } from '$lib/server/push';
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
		.select({
			id: users.id,
			displayName: users.displayName,
			emoji: users.emoji,
			capacityPercent: users.capacityPercent
		})
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

	// Mental-load credits count toward scores (noticing is work too)
	const creditRows = await getCreditsSince(new Date(Date.now() - HISTORY_DAYS * 86_400_000));
	const creditLike = creditRows.map((c) => ({
		userId: c.userId,
		pointsAwarded: c.points,
		coveredForUserId: null,
		onTime: true,
		localDate: completionLocalDate(c.createdAt, timezone)
	}));

	const thisWeek = weeklyScore([...enriched, ...creditLike], today);
	const history = weeklyHistory([...enriched, ...creditLike]);

	// Team level: all-time points, shared — it only ever grows
	const [allTime] = await db
		.select({
			count: sql<number>`count(*)::int`,
			points: sql<number>`coalesce(sum(points_awarded), 0)::int`
		})
		.from(completions);
	const [allTimeCredits] = await db
		.select({ points: sql<number>`coalesce(sum(points), 0)::int` })
		.from(creditsTable);
	const teamLevel = {
		...computeTeamLevel(allTime.points + allTimeCredits.points),
		totalPoints: allTime.points + allTimeCredits.points,
		totalChores: allTime.count
	};

	// Effort balance in minutes (this week) + dread balance (12 weeks)
	const minutesByUser: Record<number, number> = {};
	const dreadByUser: Record<number, number> = {};
	for (const c of enriched) {
		if (c.localDate >= thisWeek.weekStart) {
			minutesByUser[c.userId] = (minutesByUser[c.userId] ?? 0) + c.minutes;
		}
		if (c.dread) dreadByUser[c.userId] = (dreadByUser[c.userId] ?? 0) + 1;
	}

	// Mental-load card
	const mentalLoad: Record<number, { points: number; noticed: number; reviews: number }> = {};
	for (const c of creditRows) {
		mentalLoad[c.userId] ??= { points: 0, noticed: 0, reviews: 0 };
		mentalLoad[c.userId].points += c.points;
		if (c.reason === 'noticed') mentalLoad[c.userId].noticed++;
		else mentalLoad[c.userId].reviews++;
	}

	// Rebalance suggestion: 4 weeks of chronic minute-imbalance -> propose an
	// area swap that would roughly even it out
	let rebalance: {
		areaId: number;
		areaName: string;
		houseEmoji: string;
		fromName: string;
		toName: string;
	} | null = null;
	const fourWeeksAgo = new Date(Date.now() - 28 * 86_400_000);
	const recentMinutes: Record<number, number> = {};
	for (const c of enriched) {
		if (c.completedAt >= fourWeeksAgo) {
			recentMinutes[c.userId] = (recentMinutes[c.userId] ?? 0) + c.minutes;
		}
	}
	const [userA, userB] = allUsers;
	if (userA && userB) {
		const total = (recentMinutes[userA.id] ?? 0) + (recentMinutes[userB.id] ?? 0);
		if (total >= 120) {
			const shareA = (recentMinutes[userA.id] ?? 0) / total;
			const overloaded = shareA >= 0.6 ? userA : shareA <= 0.4 ? userB : null;
			if (overloaded) {
				const other = overloaded.id === userA.id ? userB : userA;
				const gapMinutes =
					(recentMinutes[overloaded.id] ?? 0) - (recentMinutes[other.id] ?? 0);
				const ownedAreas = await db
					.select({ id: areas.id, name: areas.name, householdId: areas.householdId })
					.from(areas)
					.where(and(eq(areas.ownerUserId, overloaded.id), isNull(areas.archivedAt)));
				let best: { area: (typeof ownedAreas)[number]; minutes: number } | null = null;
				for (const area of ownedAreas) {
					const areaMinutes = enriched
						.filter((c) => c.completedAt >= fourWeeksAgo && c.areaName === area.name)
						.reduce((s, c) => s + c.minutes, 0);
					if (areaMinutes === 0) continue;
					if (
						!best ||
						Math.abs(areaMinutes - gapMinutes / 2) < Math.abs(best.minutes - gapMinutes / 2)
					) {
						best = { area, minutes: areaMinutes };
					}
				}
				if (best) {
					rebalance = {
						areaId: best.area.id,
						areaName: best.area.name,
						houseEmoji: allHouseholds.find((h) => h.id === best.area.householdId)?.emoji ?? '',
						fromName: overloaded.displayName,
						toName: other.displayName
					};
				}
			}
		}
	}

	// Monthly fairness check-in
	const month = today.slice(0, 7);
	const allCheckins = await db.select().from(checkins).orderBy(desc(checkins.month));
	const thisMonth = allCheckins.filter((c) => c.month === month);
	const myCheckin = thisMonth.find((c) => c.userId === user.id) ?? null;
	const bothDone = thisMonth.length >= 2;
	const pastCheckins = Object.values(
		allCheckins
			.filter((c) => c.month !== month)
			.reduce<Record<string, typeof allCheckins>>((acc, c) => {
				(acc[c.month] ??= []).push(c);
				return acc;
			}, {})
	)
		.filter((group) => group.length >= 2)
		.slice(0, 6);

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
		housesById: Object.fromEntries(allHouseholds.map((h) => [h.id, h])),
		minutesByUser,
		dreadByUser,
		mentalLoad,
		rebalance,
		checkin: { month, mine: myCheckin, bothDone, entries: bothDone ? thisMonth : [], past: pastCheckins }
	};
};

export const actions: Actions = {
	swapOwner: async ({ request }) => {
		const form = await request.formData();
		const areaId = Number(form.get('areaId'));
		const toUserId = Number(form.get('toUserId'));
		if (!Number.isInteger(areaId) || !Number.isInteger(toUserId)) return fail(400);
		await db.update(areas).set({ ownerUserId: toUserId }).where(eq(areas.id, areaId));
		return { swapped: true };
	},

	checkin: async ({ request, locals }) => {
		const form = await request.formData();
		const rating = Number(form.get('rating'));
		const note = String(form.get('note') ?? '').trim() || null;
		const month = String(form.get('month') ?? '');
		if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !/^\d{4}-\d{2}$/.test(month)) {
			return fail(400);
		}
		await db
			.insert(checkins)
			.values({ userId: locals.user!.id, month, rating, note })
			.onConflictDoUpdate({
				target: [checkins.userId, checkins.month],
				set: { rating, note }
			});

		// Nudge the partner if they haven't answered yet
		try {
			const [partner] = await db
				.select({ id: users.id })
				.from(users)
				.where(ne(users.id, locals.user!.id));
			if (partner) {
				const [theirs] = await db
					.select()
					.from(checkins)
					.where(and(eq(checkins.userId, partner.id), eq(checkins.month, month)));
				if (!theirs) {
					await sendPushToUser(partner.id, {
						title: `${locals.user!.displayName} did the monthly check-in 💬`,
						body: 'How fair did this month feel to you? Takes 30 seconds.',
						url: '/stats'
					});
				}
			}
		} catch (error) {
			console.error('Check-in push failed:', error);
		}
		return { checkedIn: true };
	}
};
