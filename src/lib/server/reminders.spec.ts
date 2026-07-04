import { describe, expect, it } from 'vitest';
import { resolveReminderTargets } from './reminders';

const GIAMIR = 1;
const NINA = 2;
const GISELA = 1;
const HELGA = 2;

function task(overrides: Partial<Parameters<typeof resolveReminderTargets>[0]> = {}) {
	return {
		assignedUserId: null,
		areaOwnerUserId: GIAMIR,
		remindWhenAway: false,
		householdId: HELGA,
		...overrides
	};
}

function presence(giamirAt: number | null, ninaAt: number | null) {
	return [
		{ id: GIAMIR, currentHouseholdId: giamirAt },
		{ id: NINA, currentHouseholdId: ninaAt }
	];
}

describe('resolveReminderTargets', () => {
	it('notifies the responsible person when they are home', () => {
		expect(resolveReminderTargets(task(), presence(HELGA, HELGA))).toEqual([GIAMIR]);
	});

	it('prefers the task assignee over the area owner', () => {
		expect(
			resolveReminderTargets(task({ assignedUserId: NINA }), presence(HELGA, HELGA))
		).toEqual([NINA]);
	});

	it('notifies the present partner when the responsible person is away', () => {
		expect(resolveReminderTargets(task(), presence(GISELA, HELGA))).toEqual([NINA]);
	});

	it('stays silent for an empty house', () => {
		expect(resolveReminderTargets(task(), presence(GISELA, GISELA))).toEqual([]);
	});

	it('remindWhenAway tasks reach the responsible person even in an empty house', () => {
		expect(
			resolveReminderTargets(task({ remindWhenAway: true }), presence(GISELA, GISELA))
		).toEqual([GIAMIR]);
	});

	it('shared tasks (no assignee, no owner) notify everyone present', () => {
		expect(
			resolveReminderTargets(task({ areaOwnerUserId: null }), presence(HELGA, HELGA))
		).toEqual([GIAMIR, NINA]);
	});

	it('shared remindWhenAway tasks notify both when the house is empty', () => {
		expect(
			resolveReminderTargets(
				task({ areaOwnerUserId: null, remindWhenAway: true }),
				presence(GISELA, GISELA)
			)
		).toEqual([GIAMIR, NINA]);
	});

	it('nobody has set a location yet -> only remindWhenAway fires', () => {
		expect(resolveReminderTargets(task(), presence(null, null))).toEqual([]);
		expect(
			resolveReminderTargets(task({ remindWhenAway: true }), presence(null, null))
		).toEqual([GIAMIR]);
	});
});
