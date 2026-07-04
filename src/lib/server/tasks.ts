import { eq, ne, sql } from 'drizzle-orm';
import { db } from './db';
import { areas, completions, households, tasks, users } from './db/schema';
import { advanceDueDate } from './recurrence';
import { localToday } from '../dates';
import { sendPushToUser } from './push';
import { teamLevel } from './gamification';
import { completionCopy, coveredCopy, levelUpCopy, togetherCopy } from './push-copy';

export interface Doer {
	id: number;
	displayName: string;
}

export interface CompleteResult {
	leveledUp: boolean;
	newLevel?: number;
	newLevelTitle?: string;
}

async function loadTaskContext(taskId: number) {
	const [row] = await db
		.select({ task: tasks, area: areas, household: households })
		.from(tasks)
		.innerJoin(areas, eq(tasks.areaId, areas.id))
		.innerJoin(households, eq(areas.householdId, households.id))
		.where(eq(tasks.id, taskId));
	return row;
}

async function advanceOrArchive(row: NonNullable<Awaited<ReturnType<typeof loadTaskContext>>>, today: string) {
	if (row.task.isRecurring) {
		await db
			.update(tasks)
			.set({ nextDueDate: advanceDueDate(row.task, today) })
			.where(eq(tasks.id, row.task.id));
	} else {
		await db.update(tasks).set({ archivedAt: new Date() }).where(eq(tasks.id, row.task.id));
	}
}

/** Did this completion push the couple's all-time points past a level boundary? */
async function checkLevelUp(pointsJustAdded: number): Promise<CompleteResult> {
	const [{ total }] = await db
		.select({ total: sql<number>`coalesce(sum(points_awarded), 0)::int` })
		.from(completions);
	const before = teamLevel(total - pointsJustAdded);
	const after = teamLevel(total);
	if (after.level > before.level) {
		return { leveledUp: true, newLevel: after.level, newLevelTitle: after.title };
	}
	return { leveledUp: false };
}

export async function completeTask(taskId: number, doer: Doer): Promise<CompleteResult> {
	const row = await loadTaskContext(taskId);
	if (!row || row.task.archivedAt) return { leveledUp: false };

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
	await advanceOrArchive(row, today);
	const levelResult = await checkLevelUp(row.task.points);

	// Celebrate to the partner — a push failure must never fail the completion
	try {
		const partners = await db.select({ id: users.id }).from(users).where(ne(users.id, doer.id));
		for (const partner of partners) {
			const copy =
				coveredForUserId === partner.id
					? coveredCopy(doer.displayName, row.task.title, row.task.points)
					: completionCopy(doer.displayName, row.task.title, row.task.points, row.household.name);
			await sendPushToUser(partner.id, { ...copy, url: `/areas/${row.area.id}` });
		}
		if (levelResult.leveledUp) {
			const everyone = await db.select({ id: users.id }).from(users);
			for (const person of everyone) {
				await sendPushToUser(person.id, {
					...levelUpCopy(levelResult.newLevel!, levelResult.newLevelTitle!),
					url: '/stats'
				});
			}
		}
	} catch (error) {
		console.error('Completion push failed:', error);
	}
	return levelResult;
}

/**
 * "We did it together" — one completion row per person, points split between
 * them (sum always equals the task's points), due date advanced once.
 */
export async function completeTaskTogether(taskId: number): Promise<CompleteResult> {
	const row = await loadTaskContext(taskId);
	if (!row || row.task.archivedAt) return { leveledUp: false };

	const pair = await db.select({ id: users.id }).from(users).orderBy(users.id).limit(2);
	if (pair.length < 2) return { leveledUp: false };

	const today = localToday(row.household.timezone);
	const due = row.task.nextDueDate;
	const onTime = due === null || today <= due;
	const half = Math.floor(row.task.points / 2);

	await db.insert(completions).values(
		pair.map((person, i) => ({
			taskId,
			userId: person.id,
			dueDate: due,
			onTime,
			pointsAwarded: i === 0 ? row.task.points - half : half,
			coveredForUserId: null
		}))
	);
	await advanceOrArchive(row, today);
	const levelResult = await checkLevelUp(row.task.points);

	try {
		for (const person of pair) {
			await sendPushToUser(person.id, {
				...togetherCopy(row.task.title, row.task.points),
				url: `/areas/${row.area.id}`
			});
		}
		if (levelResult.leveledUp) {
			for (const person of pair) {
				await sendPushToUser(person.id, {
					...levelUpCopy(levelResult.newLevel!, levelResult.newLevelTitle!),
					url: '/stats'
				});
			}
		}
	} catch (error) {
		console.error('Together push failed:', error);
	}
	return levelResult;
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
