/**
 * Calendar-date helpers for date-only values in ISO-8601 form (`YYYY-MM-DD`).
 *
 * Due dates are calendar days, not instants: they are stored without a time
 * zone so "due Friday" means the same day for the user regardless of travel.
 * All functions operate on the device's local calendar day unless noted.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Formats a Date as a local calendar date string `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Today's local calendar date as `YYYY-MM-DD`. */
export function todayIsoDate(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** Returns true when the string is a well-formed, real `YYYY-MM-DD` date. */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
}

/** Parses `YYYY-MM-DD` to a Date at local midnight, or null when invalid. */
export function parseIsoDate(value: string): Date | null {
  if (!isValidIsoDate(value)) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Adds (or subtracts) whole days to a `YYYY-MM-DD` date. */
export function addDaysIsoDate(value: string, days: number): string {
  const date = parseIsoDate(value);
  if (!date) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetweenIsoDates(from: string, to: string): number {
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  if (!fromDate || !toDate) {
    throw new Error(`Invalid ISO dates: ${from}, ${to}`);
  }
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
}

/**
 * UTC instants delimiting the device-local calendar day containing `now`.
 * Used to query timestamp columns (`completed_at`) that are stored in UTC
 * while "today" is a local-calendar concept. The end instant is exclusive.
 */
export function localDayBoundsIso(now: Date = new Date()): { startIso: string; endIso: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/**
 * Calendar-date bounds of the device-local month containing `now`:
 * the first day of this month and the first day of the next (exclusive end),
 * both as `YYYY-MM-DD` strings for querying date-only columns.
 */
export function monthBoundsIsoDate(now: Date = new Date()): {
  startOn: string;
  nextStartOn: string;
} {
  return {
    startOn: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    nextStartOn: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
  };
}

/** `2026-10-11` -> `2026-10`. Throws on invalid input dates. */
export function monthKeyOf(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  if (!date) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }
  return isoDate.slice(0, 7);
}

/** True when the value is a well-formed `YYYY-MM` month key. */
export function isMonthKey(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/** Adds (or subtracts) whole months to a `YYYY-MM` key. */
export function addMonthsToKey(monthKey: string, delta: number): string {
  if (!isMonthKey(monthKey)) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  return toIsoDate(new Date(year, month - 1 + delta, 1)).slice(0, 7);
}

/**
 * Calendar bounds of a month key: its first day, its last day (inclusive),
 * and the first day of the next month (exclusive end) — all `YYYY-MM-DD`.
 */
export function monthBoundsForKey(monthKey: string): {
  startOn: string;
  lastOn: string;
  nextStartOn: string;
} {
  if (!isMonthKey(monthKey)) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }
  const startOn = `${monthKey}-01`;
  const nextStartOn = `${addMonthsToKey(monthKey, 1)}-01`;
  return { startOn, lastOn: addDaysIsoDate(nextStartOn, -1), nextStartOn };
}

/** Calendar-year bounds of the year containing the given date (exclusive end). */
export function yearBoundsOf(isoDate: string): { startOn: string; nextStartOn: string } {
  const date = parseIsoDate(isoDate);
  if (!date) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }
  const year = date.getFullYear();
  return { startOn: `${year}-01-01`, nextStartOn: `${year + 1}-01-01` };
}
