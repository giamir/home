import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { areas, completions, households, tasks, users } from '$lib/server/db/schema';
import {
	completeTask,
	completeTaskTogether,
	completionLocalDate,
	uncompleteTask
} from '$lib/server/tasks';
import { getReactions, toggleReaction } from '$lib/server/reactions';
import { computeStreak, weeklyScore } from '$lib/server/gamification';
import { addToDate, localHour, localToday } from '$lib/dates';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const allHouseholds = await db.select().from(households).orderBy(households.id);
	const currentId = user.currentHouseholdId ?? allHouseholds[0]?.id;
	const viewId = Number(url.searchParams.get('house')) || currentId;
	const household = allHouseholds.find((h) => h.id === viewId) ?? allHouseholds[0];
	const today = localToday(household.timezone);

	const taskRows = await db
		.select({
			id: tasks.id,
			title: tasks.title,
			points: tasks.points,
			nextDueDate: tasks.nextDueDate,
			isRecurring: tasks.isRecurring,
			assignedUserId: tasks.assignedUserId,
			areaOwnerUserId: areas.ownerUserId,
			areaId: areas.id,
			areaName: areas.name
		})
		.from(tasks)
		.innerJoin(areas, eq(tasks.areaId, areas.id))
		.where(
			and(eq(areas.householdId, household.id), isNull(tasks.archivedAt), isNull(areas.archivedAt))
		)
		.orderBy(tasks.nextDueDate);

	const withResponsible = taskRows.map((t) => ({
		...t,
		responsibleId: t.assignedUserId ?? t.areaOwnerUserId
	}));

	// Streaks for the recurring tasks on screen
	const recurringIds = taskRows.filter((t) => t.isRecurring).map((t) => t.id);
	const streaks: Record<number, number> = {};
	if (recurringIds.length > 0) {
		const history = await db
			.select({ taskId: completions.taskId, onTime: completions.onTime })
			.from(completions)
			.where(inArray(completions.taskId, recurringIds))
			.orderBy(desc(completions.completedAt))
			.limit(300);
		for (const task of taskRows) {
			if (!task.isRecurring) continue;
			const flags = history.filter((h) => h.taskId === task.id).map((h) => h.onTime);
			const overdue = task.nextDueDate !== null && task.nextDueDate < today;
			streaks[task.id] = computeStreak(flags, overdue);
		}
	}

	// Weekly head-to-head (completions from both houses)
	const allUsers = await db
		.select({ id: users.id, displayName: users.displayName, emoji: users.emoji })
		.from(users)
		.orderBy(users.id);
	const recent = await db
		.select()
		.from(completions)
		.where(gte(completions.completedAt, new Date(Date.now() - 9 * 86_400_000)));
	const recentLocal = recent.map((c) => ({
		...c,
		localDate: completionLocalDate(c.completedAt, household.timezone)
	}));
	const score = weeklyScore(recentLocal, today);
	const doneToday: Record<number, number> = {};
	for (const c of recentLocal) {
		if (c.localDate === today) doneToday[c.userId] = (doneToday[c.userId] ?? 0) + 1;
	}

	// Today's completion log for the viewed house
	const doneTodayList = (
		await db
			.select({
				id: completions.id,
				taskTitle: tasks.title,
				areaId: areas.id,
				userId: completions.userId,
				pointsAwarded: completions.pointsAwarded,
				coveredForUserId: completions.coveredForUserId,
				completedAt: completions.completedAt
			})
			.from(completions)
			.innerJoin(tasks, eq(completions.taskId, tasks.id))
			.innerJoin(areas, eq(tasks.areaId, areas.id))
			.where(
				and(
					eq(areas.householdId, household.id),
					gte(completions.completedAt, new Date(Date.now() - 2 * 86_400_000))
				)
			)
			.orderBy(desc(completions.completedAt))
	).filter((c) => completionLocalDate(c.completedAt, household.timezone) === today);

	const [reactions, houseAreas] = await Promise.all([
		getReactions(doneTodayList.map((c) => c.id)),
		db
			.select({ id: areas.id, name: areas.name })
			.from(areas)
			.where(and(eq(areas.householdId, household.id), isNull(areas.archivedAt)))
			.orderBy(areas.sortOrder, areas.id)
	]);

	return {
		reactions,
		houseAreas,
		household,
		viewingOther: household.id !== currentId,
		today,
		hour: localHour(household.timezone),
		streaks,
		score,
		doneToday,
		doneTodayList,
		allUsers,
		tasks: withResponsible
	};
};

export const actions: Actions = {
	complete: async ({ request, locals }) => {
		const form = await request.formData();
		const taskId = Number(form.get('taskId'));
		if (!Number.isInteger(taskId)) return fail(400);
		const result = await completeTask(taskId, locals.user!);
		return { completed: taskId, ...result };
	},
	completeTogether: async ({ request }) => {
		const form = await request.formData();
		const taskId = Number(form.get('taskId'));
		if (!Number.isInteger(taskId)) return fail(400);
		const result = await completeTaskTogether(taskId);
		return { completed: taskId, ...result };
	},
	uncomplete: async ({ request }) => {
		const form = await request.formData();
		const completionId = Number(form.get('completionId'));
		if (!Number.isInteger(completionId)) return fail(400);
		await uncompleteTask(completionId);
		return {};
	},
	snooze: async ({ request, locals }) => {
		const form = await request.formData();
		const taskId = Number(form.get('taskId'));
		if (!Number.isInteger(taskId)) return fail(400);
		const [row] = await db
			.select({ task: tasks, timezone: households.timezone })
			.from(tasks)
			.innerJoin(areas, eq(tasks.areaId, areas.id))
			.innerJoin(households, eq(areas.householdId, households.id))
			.where(eq(tasks.id, taskId));
		if (!row) return fail(404);
		const tomorrow = addToDate(localToday(row.timezone), 1, 'day');
		await db.update(tasks).set({ nextDueDate: tomorrow }).where(eq(tasks.id, taskId));
		return { snoozed: taskId };
	},
	react: async ({ request, locals }) => {
		const form = await request.formData();
		const completionId = Number(form.get('completionId'));
		const emoji = String(form.get('emoji') ?? '');
		if (!Number.isInteger(completionId) || !emoji) return fail(400);
		await toggleReaction(completionId, locals.user!, emoji);
		return {};
	},
	quickAdd: async ({ request }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const areaId = Number(form.get('areaId'));
		const points = Number(form.get('points')) || 10;
		const dueToday = form.get('dueToday') === 'on';
		if (!title || !Number.isInteger(areaId)) return fail(400, { quickAddMessage: 'Title and area required' });
		const [area] = await db
			.select({ id: areas.id, timezone: households.timezone })
			.from(areas)
			.innerJoin(households, eq(areas.householdId, households.id))
			.where(eq(areas.id, areaId));
		if (!area) return fail(404);
		await db.insert(tasks).values({
			areaId,
			title,
			points,
			isRecurring: false,
			nextDueDate: dueToday ? localToday(area.timezone) : null
		});
		return { quickAdded: true };
	}
};
