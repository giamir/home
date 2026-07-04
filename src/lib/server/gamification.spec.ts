import { describe, expect, it } from 'vitest';
import {
	computeStreak,
	coveringCounts,
	onTimeRate,
	weeklyHistory,
	weeklyScore,
	type CompletionLike
} from './gamification';

function completion(overrides: Partial<CompletionLike> = {}): CompletionLike {
	return {
		userId: 1,
		pointsAwarded: 10,
		coveredForUserId: null,
		onTime: true,
		localDate: '2026-07-01',
		...overrides
	};
}

describe('weeklyScore', () => {
	it('sums points per user for the current ISO week only', () => {
		const completions = [
			completion({ userId: 1, pointsAwarded: 10, localDate: '2026-06-29' }), // Monday, this week
			completion({ userId: 1, pointsAwarded: 5, localDate: '2026-07-04' }), // Saturday, this week
			completion({ userId: 2, pointsAwarded: 20, localDate: '2026-07-05' }), // Sunday, this week
			completion({ userId: 2, pointsAwarded: 50, localDate: '2026-06-28' }) // previous week
		];
		const score = weeklyScore(completions, '2026-07-04');
		expect(score.weekStart).toBe('2026-06-29');
		expect(score.byUser).toEqual({ 1: 15, 2: 20 });
		expect(score.team).toBe(35);
	});
});

describe('weeklyHistory', () => {
	it('groups by ISO week, most recent first', () => {
		const history = weeklyHistory([
			completion({ localDate: '2026-06-28', pointsAwarded: 50 }),
			completion({ localDate: '2026-06-29', pointsAwarded: 10 }),
			completion({ localDate: '2026-07-04', pointsAwarded: 5 })
		]);
		expect(history.map((w) => w.weekStart)).toEqual(['2026-06-29', '2026-06-22']);
		expect(history[0].team).toBe(15);
		expect(history[1].team).toBe(50);
	});
});

describe('computeStreak', () => {
	it('counts consecutive on-time completions from the newest', () => {
		expect(computeStreak([true, true, false, true], false)).toBe(2);
		expect(computeStreak([true, true, true], false)).toBe(3);
		expect(computeStreak([false, true], false)).toBe(0);
		expect(computeStreak([], false)).toBe(0);
	});

	it('is zero while the task is overdue', () => {
		expect(computeStreak([true, true, true], true)).toBe(0);
	});
});

describe('coveringCounts', () => {
	it('counts completions done on behalf of the other person', () => {
		const counts = coveringCounts([
			completion({ userId: 1, coveredForUserId: 2 }),
			completion({ userId: 1, coveredForUserId: 2 }),
			completion({ userId: 2, coveredForUserId: 1 }),
			completion({ userId: 1, coveredForUserId: null })
		]);
		expect(counts).toEqual({ 1: 2, 2: 1 });
	});
});

describe('onTimeRate', () => {
	it('returns the on-time percentage', () => {
		expect(
			onTimeRate([completion({ onTime: true }), completion({ onTime: false })])
		).toBe(50);
	});

	it('returns null with no completions', () => {
		expect(onTimeRate([])).toBeNull();
	});
});
