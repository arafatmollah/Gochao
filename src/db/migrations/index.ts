import { migration001 } from './001-initial-schema';
import { migration002 } from './002-bills';
import { migration003 } from './003-finance';
import { migration004 } from './004-transfers-budgets';
import { migration005 } from './005-notes';
import { migration006 } from './006-family';
import { migration007 } from './007-grocery';
import { migration008 } from './008-prayer';
import { migration009 } from './009-health';
import { migration010 } from './010-entertainment';
import { migration011 } from './011-prayer-reminders';
import { migration012 } from './012-prayer-utc-offset';
import type { Migration } from './types';

/**
 * Ordered, versioned migration list.
 *
 * 001 app settings and tasks
 * 002 bills and bill occurrences
 * 003 accounts, categories, and transactions
 * 004 transfers and budgets
 * 005 notes, note categories, and tags
 * 006 family members and family requests
 * 007 grocery lists and items
 * 008 prayer settings, cached schedules, and logs
 * 009 medicines, schedules, dose logs, appointments, and health records
 * 010 entertainment watchlist
 * 011 prayer reminder preference flag
 * 012 prayer location UTC offset
 *
 * Remaining planned migrations (added when their phases are implemented):
 *   013 attachments and generic reminder metadata
 */
export const MIGRATIONS: readonly Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
];

export type { Migration } from './types';
