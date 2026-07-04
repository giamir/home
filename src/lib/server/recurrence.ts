import { addToDate, maxDate, type RecurrenceUnit } from '../dates';

export interface RecurrenceFields {
	recurrenceInterval: number | null;
	recurrenceUnit: RecurrenceUnit | null;
	nextDueDate: string | null;
}

/**
 * Next due date after completing a recurring task on `completedOn` (local date).
 *
 * Daily chores roll from the completion date ("watered the plants today,
 * next in 3 days"). Weekly/monthly rhythms advance from max(old due,
 * completion) so completing early doesn't pull the schedule forward, while
 * completing late restarts from reality instead of marching through missed
 * dates.
 */
export function advanceDueDate(task: RecurrenceFields, completedOn: string): string {
	const interval = task.recurrenceInterval ?? 1;
	const unit = task.recurrenceUnit ?? 'week';
	const base =
		unit === 'day' ? completedOn : maxDate(task.nextDueDate ?? completedOn, completedOn);
	return addToDate(base, interval, unit);
}
