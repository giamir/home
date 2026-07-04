import { weekStart } from '../dates';

export const POINTS_PER_LEVEL = 200;
export const LEVEL_TITLES = [
	'Fresh Nesters',
	'Tidy Rookies',
	'Broom Buddies',
	'Dust Busters',
	'Suds Squad',
	'Sparkle Duo',
	'Order Wizards',
	'Chore Champions',
	'Household Heroes',
	'Domestic Legends'
];

export function teamLevel(totalPoints: number) {
	const level = Math.floor(totalPoints / POINTS_PER_LEVEL) + 1;
	return {
		level,
		title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
		progress: totalPoints % POINTS_PER_LEVEL,
		perLevel: POINTS_PER_LEVEL
	};
}

export interface CompletionLike {
	userId: number;
	pointsAwarded: number;
	coveredForUserId: number | null;
	onTime: boolean;
	/** Local calendar date of the completion in the household's timezone. */
	localDate: string;
}

export interface WeekScore {
	weekStart: string;
	byUser: Record<number, number>;
	team: number;
}

/** Points per user for the ISO week containing `today`. */
export function weeklyScore(completions: CompletionLike[], today: string): WeekScore {
	const start = weekStart(today);
	const byUser: Record<number, number> = {};
	let team = 0;
	for (const c of completions) {
		if (weekStart(c.localDate) !== start) continue;
		byUser[c.userId] = (byUser[c.userId] ?? 0) + c.pointsAwarded;
		team += c.pointsAwarded;
	}
	return { weekStart: start, byUser, team };
}

/** Points per user grouped by ISO week, most recent first. */
export function weeklyHistory(completions: CompletionLike[]): WeekScore[] {
	const weeks = new Map<string, WeekScore>();
	for (const c of completions) {
		const start = weekStart(c.localDate);
		let week = weeks.get(start);
		if (!week) {
			week = { weekStart: start, byUser: {}, team: 0 };
			weeks.set(start, week);
		}
		week.byUser[c.userId] = (week.byUser[c.userId] ?? 0) + c.pointsAwarded;
		week.team += c.pointsAwarded;
	}
	return [...weeks.values()].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

/**
 * Consecutive on-time completions, newest first. A currently-overdue task has
 * no streak — the chain is already broken even before the next completion.
 */
export function computeStreak(onTimeNewestFirst: boolean[], currentlyOverdue: boolean): number {
	if (currentlyOverdue) return 0;
	let streak = 0;
	for (const onTime of onTimeNewestFirst) {
		if (!onTime) break;
		streak++;
	}
	return streak;
}

/** How many times each user completed something the other was responsible for. */
export function coveringCounts(completions: CompletionLike[]): Record<number, number> {
	const counts: Record<number, number> = {};
	for (const c of completions) {
		if (c.coveredForUserId !== null && c.coveredForUserId !== c.userId) {
			counts[c.userId] = (counts[c.userId] ?? 0) + 1;
		}
	}
	return counts;
}

/** Share of completions that were on time, as a percentage (0-100). */
export function onTimeRate(completions: CompletionLike[]): number | null {
	if (completions.length === 0) return null;
	const onTime = completions.filter((c) => c.onTime).length;
	return Math.round((onTime / completions.length) * 100);
}
