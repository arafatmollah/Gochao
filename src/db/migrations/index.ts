import { migration001 } from './001-initial-schema';
import { migration002 } from './002-bills';
import { migration003 } from './003-finance';
import { migration004 } from './004-transfers-budgets';
import type { Migration } from './types';

/**
 * Ordered, versioned migration list.
 *
 * 001 app settings and tasks
 * 002 bills and bill occurrences
 * 003 accounts, categories, and transactions
 * 004 transfers and budgets
 *
 * Remaining planned migrations (added when their phases are implemented):
 *   005 notes                006 family
 *   007 groceries            008 medicine and health
 *   009 prayer               010 reminders and attachments
 */
export const MIGRATIONS: readonly Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
];

export type { Migration } from './types';
