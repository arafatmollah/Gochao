/**
 * Bill recurrence math (calendar dates only).
 *
 * Month-based recurrences are anchored to the day-of-month of the bill's
 * first due date: a bill anchored on the 31st is due Feb 28 in a non-leap
 * February and returns to the 31st in March — the anchor is never lost.
 */

import type { BillRecurrence } from '@/types/bill';

import { addDaysIsoDate, parseIsoDate, toIsoDate } from './dates';

const MONTHS_BY_RECURRENCE: Partial<Record<BillRecurrence, number>> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/** Day-of-month anchor of a `YYYY-MM-DD` date. */
export function anchorDayOf(dateIso: string): number {
  return Number(dateIso.slice(8, 10));
}

/** Next scheduled date after `current`, or null when there is no next. */
export function nextOccurrenceDate(
  current: string,
  recurrence: BillRecurrence,
  anchorDay: number,
): string | null {
  if (recurrence === 'none') {
    return null;
  }
  if (recurrence === 'weekly') {
    return addDaysIsoDate(current, 7);
  }
  const monthsToAdd = MONTHS_BY_RECURRENCE[recurrence];
  const date = parseIsoDate(current);
  if (!monthsToAdd || !date) {
    return null;
  }
  const monthIndex = date.getMonth() + monthsToAdd;
  const targetYear = date.getFullYear() + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(anchorDay, daysInTargetMonth);
  return toIsoDate(new Date(targetYear, targetMonth, day));
}

export interface OccurrenceGenerationInput {
  firstDueOn: string;
  recurrence: BillRecurrence;
  installmentCount: number | null;
  /** Latest already-materialized due date, or null when none exist. */
  lastDueOn: string | null;
  /** Number of already-materialized occurrences (any status). */
  existingCount: number;
  /** Newer dates than this are not materialized yet. */
  horizonOn: string;
}

/**
 * The due dates that still need materializing for one bill.
 *
 * The first occurrence (the schedule anchor) is always materialized, even
 * when it lies beyond the horizon; later dates are materialized up to
 * `horizonOn`. A first due date in the past produces catch-up occurrences
 * for every scheduled date since — that is how backdated payment history is
 * recorded — and an installment plan stops at its total count.
 */
export function pendingOccurrenceDates(input: OccurrenceGenerationInput): string[] {
  const { firstDueOn, recurrence, installmentCount, lastDueOn, existingCount, horizonOn } = input;
  const remaining = installmentCount === null ? Infinity : installmentCount - existingCount;
  if (remaining <= 0) {
    return [];
  }

  const anchorDay = anchorDayOf(firstDueOn);
  const dates: string[] = [];
  let next =
    lastDueOn === null ? firstDueOn : nextOccurrenceDate(lastDueOn, recurrence, anchorDay);

  while (next !== null && dates.length < remaining) {
    const isFirstEver = lastDueOn === null && dates.length === 0;
    if (!isFirstEver && next > horizonOn) {
      break;
    }
    dates.push(next);
    next = nextOccurrenceDate(next, recurrence, anchorDay);
  }
  return dates;
}
