import { and, eq, isNotNull, isNull, lte, gt } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { areas, households, tasks } from '$lib/server/db/schema';
import { completeTask, completeTaskTogether } from '$lib/server/tasks';
import { addToDate, daysBetween, localToday } from '$lib/dates';

export const load: PageServerLoad = async () => {
	const allHouseholds = await db.select().from(households).orderBy(households.id);
	const todayByHouse = Object.fromEntries(
		allHouseholds.map((h) => [h.id, localToday(h.timezone)])
	);

	const rows = await db
		.select({
			id: tasks.id,
			title: tasks.title,
			points: tasks.points,
			nextDueDate: tasks.nextDueDate,
			isRecurring: tasks.isRecurring,
			recurrenceInterval: tasks.recurrenceInterval,
			recurrenceUnit: tasks.recurrenceUnit,
			areaName: areas.name,
			householdId: areas.householdId
		})
		.from(tasks)
		.innerJoin(areas, eq(tasks.areaId, areas.id))
		.where(and(isNull(tasks.archivedAt), isNull(areas.archivedAt), isNotNull(tasks.nextDueDate)));

	const overdue = rows
		.filter((t) => t.nextDueDate! < todayByHouse[t.householdId])
		.map((t) => {
			const house = allHouseholds.find((h) => h.id === t.householdId)!;
			return {
				...t,
				houseEmoji: house.emoji,
				houseName: house.name,
				daysOverdue: -daysBetween(todayByHouse[t.householdId], t.nextDueDate!),
				cadence: t.isRecurring ? `every ${t.recurrenceInterval} ${t.recurrenceUnit}(s)` : 'one-off'
			};
		})
		.sort((a, b) => b.daysOverdue - a.daysOverdue);

	// Next 7 days preview, both houses
	const preview = rows
		.filter((t) => {
			const today = todayByHouse[t.householdId];
			const diff = daysBetween(today, t.nextDueDate!);
			return diff >= 0 && diff <= 7;
		})
		.map((t) => ({
			...t,
			houseEmoji: allHouseholds.find((h) => h.id === t.householdId)?.emoji ?? '',
			inDays: daysBetween(todayByHouse[t.householdId], t.nextDueDate!)
		}))
		.sort((a, b) => a.inDays - b.inDays);

	return { overdue, preview };
};

async function taskWithTimezone(taskId: number) {
	const [row] = await db
		.select({ task: tasks, timezone: households.timezone })
		.from(tasks)
		.innerJoin(areas, eq(tasks.areaId, areas.id))
		.innerJoin(households, eq(areas.householdId, households.id))
		.where(eq(tasks.id, taskId));
	return row;
}

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

	// Honest snooze: recurring tasks jump one full cadence from today,
	// one-offs get a week
	skip: async ({ request }) => {
		const form = await request.formData();
		const taskId = Number(form.get('taskId'));
		if (!Number.isInteger(taskId)) return fail(400);
		const row = await taskWithTimezone(taskId);
		if (!row) return fail(404);
		const today = localToday(row.timezone);
		const next = row.task.isRecurring
			? addToDate(today, row.task.recurrenceInterval ?? 1, row.task.recurrenceUnit ?? 'week')
			: addToDate(today, 1, 'week');
		await db.update(tasks).set({ nextDueDate: next }).where(eq(tasks.id, taskId));
		return {};
	},

	reschedule: async ({ request }) => {
		const form = await request.formData();
		const taskId = Number(form.get('taskId'));
		const date = String(form.get('date') ?? '');
		if (!Number.isInteger(taskId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400);
		await db.update(tasks).set({ nextDueDate: date }).where(eq(tasks.id, taskId));
		return {};
	},

	retire: async ({ request }) => {
		const form = await request.formData();
		const taskId = Number(form.get('taskId'));
		if (!Number.isInteger(taskId)) return fail(400);
		await db.update(tasks).set({ archivedAt: new Date() }).where(eq(tasks.id, taskId));
		return {};
	}
};
