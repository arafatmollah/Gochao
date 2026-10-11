/**
 * Personal finance domain types (master prompt Module D).
 *
 * Money is always integer minor units (poisha): ৳100.50 is 10050. The
 * transaction `kind` carries the sign; stored amounts are strictly positive.
 * Transfers live in their own type/table so they can never be counted as
 * income or expenses (engineering rule 11).
 */

export const ACCOUNT_TYPES = ['cash', 'bank', 'mfs', 'savings', 'other'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const CATEGORY_KINDS = ['income', 'expense'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const TRANSACTION_KINDS = ['income', 'expense'] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const ACCOUNT_NAME_MAX_LENGTH = 140;
export const CATEGORY_NAME_MAX_LENGTH = 60;
export const TRANSACTION_DESCRIPTION_MAX_LENGTH = 140;
export const TRANSACTION_RECIPIENT_MAX_LENGTH = 140;
export const TRANSACTION_NOTES_MAX_LENGTH = 2000;
export const TRANSFER_NOTES_MAX_LENGTH = 2000;

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** ISO-4217 code; single-currency (BDT) for now, stored for the future. */
  currency: string;
  /** Opening balance in minor units; never negative (documented MVP limit). */
  openingBalanceMinor: number;
  /** Archived accounts keep history but accept no new transactions. */
  isArchived: boolean;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  updatedAt: string;
}

/**
 * An account plus derived figures, computed from stored records:
 * balance = opening + income − expenses + incoming transfers − outgoing.
 */
export interface AccountWithBalance extends Account {
  balanceMinor: number;
  transactionCount: number;
  transferCount: number;
}

export interface Category {
  id: string;
  kind: CategoryKind;
  /** Display fallback; built-in categories display `categories.<id>` instead. */
  name: string;
  /** Built-ins are seeded by migration 003 and cannot be deleted. */
  isBuiltin: boolean;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryWithUsage extends Category {
  transactionCount: number;
  /** The budget row id when this category has a monthly budget, else null. */
  budgetId: string | null;
}

export interface Transaction {
  id: string;
  kind: TransactionKind;
  /** Strictly positive integer minor units. */
  amountMinor: number;
  accountId: string;
  categoryId: string;
  /** Calendar date `YYYY-MM-DD` (never an instant). */
  occurredOn: string;
  description: string;
  /** Optional recipient / merchant (expenses). */
  recipient: string | null;
  notes: string | null;
  /**
   * Set when this expense was created by recording a bill payment.
   * UNIQUE in SQL: at most one expense per paid occurrence, so retried
   * bill payments cannot duplicate expenses.
   */
  billOccurrenceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  occurredOn: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A monthly budget for one expense category. Usage is always derived. */
export interface Budget {
  id: string;
  categoryId: string;
  amountMinor: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetWithUsage extends Budget {
  categoryName: string;
  categoryIsBuiltin: boolean;
  /** Expense total of this category within the queried month. */
  spentMinor: number;
}

export const ACTIVITY_KINDS = ['income', 'expense', 'transfer'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/**
 * One row of the unified activity feed: income/expense transactions and
 * transfers, joined with display fields. Transfers carry their own kind so
 * totals never mix them into income/expense sums.
 */
export interface ActivityRow {
  id: string;
  kind: ActivityKind;
  amountMinor: number;
  occurredOn: string;
  /** Transaction description; null for transfers. */
  description: string | null;
  accountId: string;
  accountName: string;
  /** Set for transfers (destination account). */
  toAccountId: string | null;
  toAccountName: string | null;
  /** Set for transactions. */
  categoryId: string | null;
  categoryName: string | null;
  categoryIsBuiltin: boolean;
  /** Transaction/transfer notes; null when unset. */
  notes: string | null;
  billOccurrenceId: string | null;
  createdAt: string;
}

export interface ActivityFilter {
  kind?: ActivityKind;
  accountId?: string;
  categoryId?: string;
  /** Inclusive calendar bounds `YYYY-MM-DD`. */
  fromOn?: string;
  toOn?: string;
  /** Literal substring match over description / recipient / transfer notes. */
  search?: string;
  limit?: number;
  offset?: number;
}

/** Income/expense totals for a scope; transfers are structurally excluded. */
export interface FinanceTotals {
  incomeMinor: number;
  expenseMinor: number;
  /** income − expense. */
  netMinor: number;
}

export interface CategoryTotal {
  categoryId: string;
  categoryName: string;
  categoryIsBuiltin: boolean;
  totalMinor: number;
}

export interface MonthNetItem {
  monthKey: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  openingBalanceMinor?: number;
  currency?: string;
}

export interface UpdateAccountInput {
  name?: string;
  type?: AccountType;
  openingBalanceMinor?: number;
  isArchived?: boolean;
}

export interface CreateTransactionInput {
  kind: TransactionKind;
  amountMinor: number;
  accountId: string;
  categoryId: string;
  occurredOn: string;
  description: string;
  recipient?: string | null;
  notes?: string | null;
}

/** `kind`, `id`, and timestamps are immutable after creation. */
export interface UpdateTransactionInput {
  amountMinor?: number;
  accountId?: string;
  categoryId?: string;
  occurredOn?: string;
  description?: string;
  recipient?: string | null;
  notes?: string | null;
}

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  occurredOn: string;
  notes?: string | null;
}

export interface UpdateTransferInput {
  fromAccountId?: string;
  toAccountId?: string;
  amountMinor?: number;
  occurredOn?: string;
  notes?: string | null;
}

export interface CreateCategoryInput {
  kind: CategoryKind;
  name: string;
}

export interface UpdateCategoryInput {
  name?: string;
  isArchived?: boolean;
}

export interface CreateBudgetInput {
  categoryId: string;
  amountMinor: number;
}
