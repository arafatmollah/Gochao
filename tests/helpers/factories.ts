import type { Bill, BillDueItem, BillSummary } from '@/types/bill';
import type {
  Account,
  AccountWithBalance,
  ActivityRow,
  Budget,
  BudgetWithUsage,
  Category,
  CategoryWithUsage,
  Transaction,
  Transfer,
} from '@/types/finance';
import type { Task } from '@/types/task';

const BASE_TIMESTAMP = '2026-10-11T05:00:00.000Z';

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 'task-1',
    title: overrides.title ?? 'Test task',
    description: overrides.description ?? null,
    dueAt: overrides.dueAt ?? null,
    priority: overrides.priority ?? 'medium',
    status: overrides.status ?? 'pending',
    parentTaskId: overrides.parentTaskId ?? null,
    createdAt: overrides.createdAt ?? BASE_TIMESTAMP,
    updatedAt: overrides.updatedAt ?? BASE_TIMESTAMP,
    completedAt:
      overrides.completedAt ??
      (overrides.status === 'completed' ? BASE_TIMESTAMP : null),
  };
}

export function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: overrides.id ?? 'bill-1',
    name: overrides.name ?? 'Internet',
    category: overrides.category ?? 'internet',
    expectedAmountMinor: overrides.expectedAmountMinor ?? 125_000,
    recurrence: overrides.recurrence ?? 'monthly',
    firstDueOn: overrides.firstDueOn ?? '2026-10-05',
    installmentCount: overrides.installmentCount ?? null,
    reminderDaysBefore: overrides.reminderDaysBefore ?? null,
    notes: overrides.notes ?? null,
    isArchived: overrides.isArchived ?? false,
    createdAt: overrides.createdAt ?? BASE_TIMESTAMP,
    updatedAt: overrides.updatedAt ?? BASE_TIMESTAMP,
  };
}

export function makeBillSummary(overrides: Partial<BillSummary> = {}): BillSummary {
  return {
    ...makeBill(overrides),
    nextDueOn: overrides.nextDueOn ?? '2026-10-20',
    paidCount: overrides.paidCount ?? 0,
    occurrenceCount: overrides.occurrenceCount ?? 3,
  };
}

export function makeBillDueItem(overrides: Partial<BillDueItem> = {}): BillDueItem {
  return {
    id: overrides.id ?? 'occ-1',
    billId: overrides.billId ?? 'bill-1',
    dueOn: overrides.dueOn ?? '2026-10-20',
    expectedAmountMinor: overrides.expectedAmountMinor ?? 125_000,
    status: overrides.status ?? 'pending',
    paidAmountMinor:
      overrides.paidAmountMinor ?? (overrides.status === 'paid' ? 125_000 : null),
    paidOn: overrides.paidOn ?? (overrides.status === 'paid' ? '2026-10-20' : null),
    createdAt: overrides.createdAt ?? BASE_TIMESTAMP,
    updatedAt: overrides.updatedAt ?? BASE_TIMESTAMP,
    billName: overrides.billName ?? 'Internet',
    billCategory: overrides.billCategory ?? 'internet',
  };
}

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: overrides.id ?? 'acc-1',
    name: overrides.name ?? 'Cash',
    type: overrides.type ?? 'cash',
    currency: overrides.currency ?? 'BDT',
    openingBalanceMinor: overrides.openingBalanceMinor ?? 0,
    isArchived: overrides.isArchived ?? false,
    createdAt: overrides.createdAt ?? BASE_TIMESTAMP,
    updatedAt: overrides.updatedAt ?? BASE_TIMESTAMP,
  };
}

export function makeAccountWithBalance(overrides: Partial<AccountWithBalance> = {}): AccountWithBalance {
  return {
    ...makeAccount(overrides),
    balanceMinor: overrides.balanceMinor ?? 0,
    transactionCount: overrides.transactionCount ?? 0,
    transferCount: overrides.transferCount ?? 0,
  };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: overrides.id ?? 'cat_expense_food',
    kind: overrides.kind ?? 'expense',
    name: overrides.name ?? 'Food',
    isBuiltin: overrides.isBuiltin ?? true,
    isArchived: overrides.isArchived ?? false,
    sortOrder: overrides.sortOrder ?? 1,
    createdAt: overrides.createdAt ?? BASE_TIMESTAMP,
    updatedAt: overrides.updatedAt ?? BASE_TIMESTAMP,
  };
}

export function makeCategoryWithUsage(
  overrides: Partial<CategoryWithUsage> = {},
): CategoryWithUsage {
  return {
    ...makeCategory(overrides),
    transactionCount: overrides.transactionCount ?? 0,
    budgetId: overrides.budgetId ?? null,
  };
}

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id ?? 'tx-1',
    kind: overrides.kind ?? 'expense',
    amountMinor: overrides.amountMinor ?? 50_000,
    accountId: overrides.accountId ?? 'acc-1',
    categoryId: overrides.categoryId ?? 'cat_expense_food',
    occurredOn: overrides.occurredOn ?? '2026-10-11',
    description: overrides.description ?? 'Lunch',
    recipient: overrides.recipient ?? null,
    notes: overrides.notes ?? null,
    billOccurrenceId: overrides.billOccurrenceId ?? null,
    createdAt: overrides.createdAt ?? BASE_TIMESTAMP,
    updatedAt: overrides.updatedAt ?? BASE_TIMESTAMP,
  };
}

export function makeTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: overrides.id ?? 'tr-1',
    fromAccountId: overrides.fromAccountId ?? 'acc-1',
    toAccountId: overrides.toAccountId ?? 'acc-2',
    amountMinor: overrides.amountMinor ?? 100_000,
    occurredOn: overrides.occurredOn ?? '2026-10-11',
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? BASE_TIMESTAMP,
    updatedAt: overrides.updatedAt ?? BASE_TIMESTAMP,
  };
}

export function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: overrides.id ?? 'budget-1',
    categoryId: overrides.categoryId ?? 'cat_expense_food',
    amountMinor: overrides.amountMinor ?? 500_000,
    createdAt: overrides.createdAt ?? BASE_TIMESTAMP,
    updatedAt: overrides.updatedAt ?? BASE_TIMESTAMP,
  };
}

export function makeBudgetWithUsage(overrides: Partial<BudgetWithUsage> = {}): BudgetWithUsage {
  return {
    ...makeBudget(overrides),
    categoryName: overrides.categoryName ?? 'Food',
    categoryIsBuiltin: overrides.categoryIsBuiltin ?? true,
    spentMinor: overrides.spentMinor ?? 0,
  };
}

export function makeActivityRow(overrides: Partial<ActivityRow> = {}): ActivityRow {
  const kind = overrides.kind ?? 'expense';
  return {
    id: overrides.id ?? 'tx-1',
    kind,
    amountMinor: overrides.amountMinor ?? 50_000,
    occurredOn: overrides.occurredOn ?? '2026-10-11',
    description: overrides.description ?? (kind === 'transfer' ? null : 'Lunch'),
    accountId: overrides.accountId ?? 'acc-1',
    accountName: overrides.accountName ?? 'Cash',
    toAccountId: overrides.toAccountId ?? (kind === 'transfer' ? 'acc-2' : null),
    toAccountName: overrides.toAccountName ?? (kind === 'transfer' ? 'Bank' : null),
    categoryId: overrides.categoryId ?? (kind === 'transfer' ? null : 'cat_expense_food'),
    categoryName: overrides.categoryName ?? (kind === 'transfer' ? null : 'Food'),
    categoryIsBuiltin: overrides.categoryIsBuiltin ?? kind !== 'transfer',
    notes: overrides.notes ?? null,
    billOccurrenceId: overrides.billOccurrenceId ?? null,
    createdAt: overrides.createdAt ?? BASE_TIMESTAMP,
  };
}
