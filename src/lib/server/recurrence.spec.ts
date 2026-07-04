import { describe, expect, it } from 'vitest';
import { advanceDueDate } from './recurrence';
import { addToDate, daysBetween, localToday, weekStart } from '../dates';

describe('addToDate', () => {
	it('adds days', () => {
		expect(addToDate('2026-07-04', 3, 'day')).toBe('2026-07-07');
	});

	it('adds weeks', () => {
		expect(addToDate('2026-07-04', 2, 'week')).toBe('2026-07-18');
	});

	it('crosses month and year boundaries', () => {
		expect(addToDate('2026-12-30', 5, 'day')).toBe('2027-01-04');
	});

	it('adds months, clamping to month end', () => {
		expect(addToDate('2026-01-31', 1, 'month')).toBe('2026-02-28');
		expect(addToDate('2028-01-31', 1, 'month')).toBe('2028-02-29'); // leap year
		expect(addToDate('2026-03-15', 1, 'month')).toBe('2026-04-15');
	});
});

describe('advanceDueDate', () => {
	const daily = { recurrenceInterval: 3, recurrenceUnit: 'day' as const, nextDueDate: '2026-07-04' };
	const weekly = {
		recurrenceInterval: 1,
		recurrenceUnit: 'week' as const,
		nextDueDate: '2026-07-04'
	};

	it('daily tasks roll from the completion date', () => {
		expect(advanceDueDate(daily, '2026-07-06')).toBe('2026-07-09');
		expect(advanceDueDate(daily, '2026-07-02')).toBe('2026-07-05'); // early completion
	});

	it('weekly tasks completed early keep their rhythm', () => {
		expect(advanceDueDate(weekly, '2026-07-02')).toBe('2026-07-11'); // from old due, not completion
	});

	it('weekly tasks completed late restart from reality', () => {
		expect(advanceDueDate(weekly, '2026-07-10')).toBe('2026-07-17');
	});

	it('completed exactly on the due date', () => {
		expect(advanceDueDate(weekly, '2026-07-04')).toBe('2026-07-11');
	});
});

describe('weekStart', () => {
	it('returns Monday of the ISO week', () => {
		expect(weekStart('2026-07-04')).toBe('2026-06-29'); // Saturday -> previous Monday
		expect(weekStart('2026-06-29')).toBe('2026-06-29'); // Monday is its own start
		expect(weekStart('2026-07-05')).toBe('2026-06-29'); // Sunday belongs to previous Monday
	});
});

describe('daysBetween', () => {
	it('is positive when the second date is later', () => {
		expect(daysBetween('2026-07-01', '2026-07-04')).toBe(3);
		expect(daysBetween('2026-07-04', '2026-07-01')).toBe(-3);
	});
});

describe('localToday', () => {
	it('respects the timezone', () => {
		// 23:30 UTC on July 4th is already July 5th in Rome (UTC+2 in summer)
		const lateUtc = new Date('2026-07-04T23:30:00Z');
		expect(localToday('Europe/Rome', lateUtc)).toBe('2026-07-05');
		expect(localToday('UTC', lateUtc)).toBe('2026-07-04');
	});
});
