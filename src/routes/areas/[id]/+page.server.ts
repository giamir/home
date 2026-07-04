import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	areaResponsibilities,
	areas,
	completions,
	households,
	tasks,
	users
} from '$lib/server/db/schema';
import { completeTask, uncompleteTask } from '$lib/server/tasks';
import { computeStreak } from '$lib/server/gamification';
import { localToday } from '$lib/dates';

async function loadArea(id: number) {
	const [row] = await db
		.select({ area: areas, household: households })
		.from(areas)
		.innerJoin(households, eq(areas.householdId, households.id))
		.where(eq(areas.id, id));
	return row;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const row = await loadArea(id);
	if (!row) error(404, 'Area not found');

	const today = localToday(row.household.timezone);

	const [responsibilities, openTasks, recentCompletions, allUsers, otherHouseholds] =
		await Promise.all([
			db
				.select()
				.from(areaResponsibilities)
				.where(eq(areaResponsibilities.areaId, id))
				.orderBy(areaResponsibilities.sortOrder, areaResponsibilities.id),
			db
				.select()
				.from(tasks)
				.where(and(eq(tasks.areaId, id), isNull(tasks.archivedAt)))
				.orderBy(tasks.nextDueDate),
			db
				.select({
					id: completions.id,
					completedAt: completions.completedAt,
					pointsAwarded: completions.pointsAwarded,
					coveredForUserId: completions.coveredForUserId,
					taskTitle: tasks.title,
					userId: users.id,
					userName: users.displayName,
					userEmoji: users.emoji
				})
				.from(completions)
				.innerJoin(tasks, eq(completions.taskId, tasks.id))
				.innerJoin(users, eq(completions.userId, users.id))
				.where(eq(tasks.areaId, id))
				.orderBy(desc(completions.completedAt))
				.limit(10),
			db
				.select({ id: users.id, displayName: users.displayName, emoji: users.emoji })
				.from(users)
				.orderBy(users.id),
			db.select().from(households).where(ne(households.id, row.area.householdId))
		]);

	const recurringIds = openTasks.filter((t) => t.isRecurring).map((t) => t.id);
	const streaks: Record<number, number> = {};
	if (recurringIds.length > 0) {
		const history = await db
			.select({ taskId: completions.taskId, onTime: completions.onTime })
			.from(completions)
			.where(inArray(completions.taskId, recurringIds))
			.orderBy(desc(completions.completedAt))
			.limit(200);
		for (const task of openTasks) {
			if (!task.isRecurring) continue;
			const flags = history.filter((h) => h.taskId === task.id).map((h) => h.onTime);
			const overdue = task.nextDueDate !== null && task.nextDueDate < today;
			streaks[task.id] = computeStreak(flags, overdue);
		}
	}

	return {
		area: row.area,
		household: row.household,
		otherHousehold: otherHouseholds[0] ?? null,
		responsibilities,
		tasks: openTasks,
		recentCompletions,
		streaks,
		allUsers,
		today
	};
};

export const actions: Actions = {
	updateArea: async ({ params, request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'Name required' });
		await db
			.update(areas)
			.set({
				name,
				icon: String(form.get('icon') ?? 'house'),
				ownerUserId: form.get('ownerUserId') ? Number(form.get('ownerUserId')) : null
			})
			.where(eq(areas.id, Number(params.id)));
		return {};
	},

	archiveArea: async ({ params }) => {
		await db.update(areas).set({ archivedAt: new Date() }).where(eq(areas.id, Number(params.id)));
		redirect(303, '/areas');
	},

	duplicateArea: async ({ params }) => {
		const id = Number(params.id);
		const row = await loadArea(id);
		if (!row) error(404);
		const [other] = await db
			.select()
			.from(households)
			.where(ne(households.id, row.area.householdId));
		if (!other) return fail(400, { message: 'No other house to copy to' });

		const [copy] = await db
			.insert(areas)
			.values({
				householdId: other.id,
				name: row.area.name,
				icon: row.area.icon,
				ownerUserId: row.area.ownerUserId,
				sortOrder: row.area.sortOrder
			})
			.returning();

		const respRows = await db
			.select()
			.from(areaResponsibilities)
			.where(eq(areaResponsibilities.areaId, id));
		if (respRows.length > 0) {
			await db.insert(areaResponsibilities).values(
				respRows.map((r) => ({ areaId: copy.id, text: r.text, sortOrder: r.sortOrder }))
			);
		}

		const taskRows = await db
			.select()
			.from(tasks)
			.where(and(eq(tasks.areaId, id), isNull(tasks.archivedAt)));
		if (taskRows.length > 0) {
			await db.insert(tasks).values(
				taskRows.map((t) => ({
					areaId: copy.id,
					title: t.title,
					notes: t.notes,
					points: t.points,
					assignedUserId: t.assignedUserId,
					isRecurring: t.isRecurring,
					recurrenceInterval: t.recurrenceInterval,
					recurrenceUnit: t.recurrenceUnit,
					nextDueDate: t.nextDueDate ?? localToday(other.timezone),
					remindWhenAway: t.remindWhenAway
				}))
			);
		}
		redirect(303, `/areas/${copy.id}`);
	},

	addResponsibility: async ({ params, request }) => {
		const form = await request.formData();
		const text = String(form.get('text') ?? '').trim();
		if (!text) return fail(400);
		await db
			.insert(areaResponsibilities)
			.values({ areaId: Number(params.id), text, sortOrder: 999 });
		return {};
	},

	updateResponsibility: async ({ request }) => {
		const form = await request.formData();
		const text = String(form.get('text') ?? '').trim();
		const id = Number(form.get('responsibilityId'));
		if (!text || !Number.isInteger(id)) return fail(400);
		await db.update(areaResponsibilities).set({ text }).where(eq(areaResponsibilities.id, id));
		return {};
	},

	deleteResponsibility: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('responsibilityId'));
		if (!Number.isInteger(id)) return fail(400);
		await db.delete(areaResponsibilities).where(eq(areaResponsibilities.id, id));
		return {};
	},

	addTask: async ({ params, request }) => {
		const form = await request.formData();
		const values = taskFormValues(form);
		if (!values.title) return fail(400, { message: 'Title required' });
		await db.insert(tasks).values({ areaId: Number(params.id), ...values });
		return {};
	},

	updateTask: async ({ request }) => {
		const form = await request.formData();
		const taskId = Number(form.get('taskId'));
		const values = taskFormValues(form);
		if (!values.title || !Number.isInteger(taskId)) return fail(400);
		await db.update(tasks).set(values).where(eq(tasks.id, taskId));
		return {};
	},

	archiveTask: async ({ request }) => {
		const form = await request.formData();
		const taskId = Number(form.get('taskId'));
		if (!Number.isInteger(taskId)) return fail(400);
		await db.update(tasks).set({ archivedAt: new Date() }).where(eq(tasks.id, taskId));
		return {};
	},

	complete: async ({ request, locals }) => {
		const form = await request.formData();
		const taskId = Number(form.get('taskId'));
		if (!Number.isInteger(taskId)) return fail(400);
		await completeTask(taskId, locals.user!);
		return {};
	},

	uncomplete: async ({ request, locals }) => {
		const form = await request.formData();
		const completionId = Number(form.get('completionId'));
		if (!Number.isInteger(completionId)) return fail(400);
		await uncompleteTask(completionId, locals.user!.id);
		return {};
	}
};

function taskFormValues(form: FormData) {
	const isRecurring = form.get('isRecurring') === 'on';
	const dueDate = String(form.get('nextDueDate') ?? '');
	return {
		title: String(form.get('title') ?? '').trim(),
		notes: String(form.get('notes') ?? '').trim() || null,
		points: Number(form.get('points')) || 10,
		assignedUserId: form.get('assignedUserId') ? Number(form.get('assignedUserId')) : null,
		isRecurring,
		recurrenceInterval: isRecurring ? Number(form.get('recurrenceInterval')) || 1 : null,
		recurrenceUnit: isRecurring
			? ((String(form.get('recurrenceUnit') ?? 'week') as 'day' | 'week' | 'month') ?? 'week')
			: null,
		nextDueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
		remindWhenAway: form.get('remindWhenAway') === 'on'
	};
}
