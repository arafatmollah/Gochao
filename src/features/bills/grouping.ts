import type { BillDueItem } from '@/types/bill';
import { daysBetweenIsoDates } from '@/utils/dates';

/** Stable section identifiers; screens translate them to localized titles. */
export type BillDueSectionKey = 'overdue' | 'today' | 'week' | 'later';

export interface BillDueSection {
  key: BillDueSectionKey;
  tone?: 'danger';
  data: BillDueItem[];
}

/** How many days ahead fall into the "next 7 days" section (inclusive). */
const WEEK_WINDOW_DAYS = 7;

/**
 * Groups pending occurrences (already ordered by the repository: due date
 * first, then bill name) into the sections shown on the Due list. Order
 * within a section is preserved.
 */
export function buildDueSections(items: BillDueItem[], today: string): BillDueSection[] {
  const overdue: BillDueItem[] = [];
  const dueToday: BillDueItem[] = [];
  const thisWeek: BillDueItem[] = [];
  const later: BillDueItem[] = [];

  for (const item of items) {
    if (item.dueOn < today) {
      overdue.push(item);
    } else if (item.dueOn === today) {
      dueToday.push(item);
    } else if (daysBetweenIsoDates(today, item.dueOn) <= WEEK_WINDOW_DAYS) {
      thisWeek.push(item);
    } else {
      later.push(item);
    }
  }

  const sections: BillDueSection[] = [];
  if (overdue.length > 0) sections.push({ key: 'overdue', tone: 'danger', data: overdue });
  if (dueToday.length > 0) sections.push({ key: 'today', data: dueToday });
  if (thisWeek.length > 0) sections.push({ key: 'week', data: thisWeek });
  if (later.length > 0) sections.push({ key: 'later', data: later });
  return sections;
}
