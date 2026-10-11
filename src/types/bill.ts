export const BILL_CATEGORIES = [
  'electricity',
  'internet',
  'water',
  'gas',
  'rent',
  'phone',
  'credit_card',
  'subscription',
  'education',
  'other',
] as const;
export type BillCategory = (typeof BILL_CATEGORIES)[number];

export const BILL_RECURRENCES = ['none', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type BillRecurrence = (typeof BILL_RECURRENCES)[number];

export const BILL_OCCURRENCE_STATUSES = ['pending', 'paid'] as const;
export type BillOccurrenceStatus = (typeof BILL_OCCURRENCE_STATUSES)[number];

export const BILL_NAME_MAX_LENGTH = 140;
export const BILL_NOTES_MAX_LENGTH = 2000;
export const INSTALLMENT_COUNT_MIN = 2;
export const INSTALLMENT_COUNT_MAX = 240;
export const REMINDER_DAYS_MAX = 30;

/**
 * A bill definition: the recurring (or one-off) obligation the user set up.
 * Occurrences — the individual dues that get paid — live in
 * `BillOccurrence`, separately from this definition.
 */
export interface Bill {
  id: string;
  name: string;
  category: BillCategory;
  /** Expected amount in integer minor units (poisha). Never a float. */
  expectedAmountMinor: number;
  recurrence: BillRecurrence;
  /** Calendar date `YYYY-MM-DD` anchoring the schedule's first occurrence. */
  firstDueOn: string;
  /**
   * Total number of payments for installment plans (কিস্তি); null for
   * open-ended bills. When set, occurrence generation stops at this count.
   */
  installmentCount: number | null;
  /**
   * Days before the due date to remind the user; null when no reminder is
   * configured. Only a stored preference for now — it is not yet wired to
   * OS notifications (that infrastructure is a later phase).
   */
  reminderDaysBefore: number | null;
  notes: string | null;
  /** Archived bills are hidden from due lists and stop generating occurrences. */
  isArchived: boolean;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
}

/** A single scheduled due of a bill, carrying its own payment record. */
export interface BillOccurrence {
  id: string;
  billId: string;
  /** Calendar due date `YYYY-MM-DD`. */
  dueOn: string;
  /** Expected amount at the time of scheduling, integer minor units. */
  expectedAmountMinor: number;
  status: BillOccurrenceStatus;
  /** Actual paid amount in minor units; set exactly when status is `paid`. */
  paidAmountMinor: number | null;
  /** Calendar date the user recorded the payment for; set exactly when paid. */
  paidOn: string | null;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
}

/** An occurrence joined with its bill's display fields (list queries). */
export interface BillDueItem extends BillOccurrence {
  billName: string;
  billCategory: BillCategory;
}

/** A bill definition plus derived schedule facts for the bills list. */
export interface BillSummary extends Bill {
  /** Earliest pending due date, or null when nothing is pending. */
  nextDueOn: string | null;
  paidCount: number;
  occurrenceCount: number;
}

export interface CreateBillInput {
  name: string;
  category: BillCategory;
  expectedAmountMinor: number;
  recurrence: BillRecurrence;
  firstDueOn: string;
  installmentCount?: number | null;
  reminderDaysBefore?: number | null;
  notes?: string | null;
}

/**
 * Editable fields of a bill. Recurrence, first due date, and installment
 * count are deliberately immutable after creation: changing them would
 * rewrite an existing schedule (including possibly-paid occurrences).
 */
export interface UpdateBillInput {
  name?: string;
  category?: BillCategory;
  expectedAmountMinor?: number;
  reminderDaysBefore?: number | null;
  notes?: string | null;
  isArchived?: boolean;
}

export interface RecordPaymentInput {
  /** Defaults to the occurrence's expected amount. */
  paidAmountMinor?: number;
  /** Defaults to today's local calendar date. */
  paidOn?: string;
  /**
   * Account the money left from. When set, recording the payment also files
   * a matching expense transaction (same DB transaction), so the payment is
   * never forgotten in the finance ledger. Null / omitted records the local
   * payment only, without touching any account.
   */
  accountId?: string | null;
}

export interface OccurrenceFilter {
  status?: BillOccurrenceStatus;
  /** Only occurrences with `due_on <= this` (`YYYY-MM-DD`). */
  dueOnOrBefore?: string;
  /** When true, occurrences of archived bills are included (used by history). */
  includeArchivedBills?: boolean;
  limit?: number;
  offset?: number;
}
