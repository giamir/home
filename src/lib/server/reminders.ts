export interface PresenceUser {
	id: number;
	currentHouseholdId: number | null;
}

export interface ReminderTaskContext {
	assignedUserId: number | null;
	areaOwnerUserId: number | null;
	remindWhenAway: boolean;
	householdId: number;
}

/**
 * Who should be nudged about a due task, given where everyone currently is.
 *
 * 1. The responsible person (task assignee, else area owner, else both) is
 *    present in the task's house -> notify them.
 * 2. Responsible person is away but someone else is present -> notify who's
 *    there (they can cover).
 * 3. House is empty -> nobody, unless the task is flagged remindWhenAway
 *    (plants, bills) -> notify the responsible person anyway.
 */
export function resolveReminderTargets(task: ReminderTaskContext, users: PresenceUser[]): number[] {
	const responsible = task.assignedUserId ?? task.areaOwnerUserId;
	const responsibleIds = responsible !== null ? [responsible] : users.map((u) => u.id);

	const presentIds = users
		.filter((u) => u.currentHouseholdId === task.householdId)
		.map((u) => u.id);

	const responsiblePresent = responsibleIds.filter((id) => presentIds.includes(id));
	if (responsiblePresent.length > 0) return responsiblePresent;
	if (presentIds.length > 0) return presentIds;
	return task.remindWhenAway ? responsibleIds : [];
}
