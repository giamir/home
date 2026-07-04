import { eq, ne } from 'drizzle-orm';
import { db } from './db';
import { areas, completions, households, tasks, users } from './db/schema';
import { advanceDueDate } from './recurrence';
import { localToday } from '../dates';
import { sendPushToUser } from './push';

export interface Doer {
	id: number;
	displayName: string;
}

export async function completeTask(taskId: number, doer: Doer) {
	const [row] = await db
		.select({ task: tasks, area: areas, household: households })
		.from(tasks)
		.innerJoin(areas, eq(tasks.areaId, areas.id))
		.innerJoin(households, eq(areas.householdId, households.id))
		.where(eq(tasks.id, taskId));
	if (!row || row.task.archivedAt) return;

	const today = localToday(row.household.timezone);
	const due = row.task.nextDueDate;
	const onTime = due === null || today <= due;
	const responsible = row.task.assignedUserId ?? row.area.ownerUserId;
	const coveredForUserId = responsible !== null && responsible !== doer.id ? responsible : null;

	await db.insert(completions).values({
		taskId,
		userId: doer.id,
		dueDate: due,
		onTime,
		pointsAwarded: row.task.points,
		coveredForUserId
	});

	if (row.task.isRecurring) {
		await db
			.update(tasks)
			.set({ nextDueDate: advanceDueDate(row.task, today) })
			.where(eq(tasks.id, taskId));
	} else {
		await db.update(tasks).set({ archivedAt: new Date() }).where(eq(tasks.id, taskId));
	}

	// Celebrate to the partner — a push failure must never fail the completion
	try {
		const partners = await db
			.select({ id: users.id })
			.from(users)
			.where(ne(users.id, doer.id));
		for (const partner of partners) {
			const covered = coveredForUserId === partner.id;
			await sendPushToUser(partner.id, {
				title: covered
					? `${doer.displayName} covered for you 💚`
					: `${doer.displayName} did a chore ✅`,
				body: `${row.task.title} at ${row.household.emoji} ${row.household.name} (+${row.task.points})`,
				url: `/areas/${row.area.id}`
			});
		}
	} catch (error) {
		console.error('Completion push failed:', error);
	}
}

/**
 * Undo a completion and restore the task's due date. Either partner can undo
 * either's completion — it's a two-person household, and mistakes happen on
 * whichever phone is closest.
 */
export async function uncompleteTask(completionId: number) {
	const [completion] = await db
		.select()
		.from(completions)
		.where(eq(completions.id, completionId));
	if (!completion) return;

	await db.delete(completions).where(eq(completions.id, completionId));
	await db
		.update(tasks)
		.set({ nextDueDate: completion.dueDate, archivedAt: null })
		.where(eq(tasks.id, completion.taskId));
}

/** Local calendar date of a completion instant, for scoring. */
export function completionLocalDate(completedAt: Date, timezone: string): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(completedAt);
}
