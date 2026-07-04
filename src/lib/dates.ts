/**
 * Calendar-date helpers. Due dates are plain 'YYYY-MM-DD' strings meaning
 * "this calendar day in the household's timezone" — never UTC dates.
 */

export type RecurrenceUnit = 'day' | 'week' | 'month';

/** Today's calendar date in the given IANA timezone. */
export function localToday(timezone: string, now: Date = new Date()): string {
	// en-CA formats as YYYY-MM-DD
	return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
}

/** Current hour (0-23) in the given IANA timezone. */
export function localHour(timezone: string, now: Date = new Date()): number {
	return Number(
		new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: 'numeric', hour12: false })
			.format(now)
			.replace('24', '0')
	);
}

export function addToDate(dateStr: string, interval: number, unit: RecurrenceUnit): string {
	const [y, m, d] = dateStr.split('-').map(Number);
	if (unit === 'month') {
		// Clamp to the last day of the target month (Jan 31 + 1 month -> Feb 28/29)
		const lastDay = new Date(Date.UTC(y, m - 1 + interval + 1, 0)).getUTCDate();
		return toDateString(new Date(Date.UTC(y, m - 1 + interval, Math.min(d, lastDay))));
	}
	const days = unit === 'week' ? interval * 7 : interval;
	return toDateString(new Date(Date.UTC(y, m - 1, d + days)));
}

export function maxDate(a: string, b: string): string {
	return a >= b ? a : b; // ISO strings compare lexicographically
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
	return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);
}

/** ISO week start (Monday) for the given calendar date. */
export function weekStart(dateStr: string): string {
	const [y, m, d] = dateStr.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	const dow = dt.getUTCDay(); // 0 = Sunday
	const diff = dow === 0 ? -6 : 1 - dow;
	return toDateString(new Date(Date.UTC(y, m - 1, d + diff)));
}

function toUtcMs(dateStr: string): number {
	const [y, m, d] = dateStr.split('-').map(Number);
	return Date.UTC(y, m - 1, d);
}

function toDateString(dt: Date): string {
	return dt.toISOString().slice(0, 10);
}
