import type { AccountRepository } from '@/db/repositories/account-repository';
import type { BillRepository } from '@/db/repositories/bill-repository';
import type { BillCategory, BillDueItem, RecordPaymentInput } from '@/types/bill';
import type { Transaction } from '@/types/finance';
import { todayIsoDate } from '@/utils/dates';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import { validatePaidAmount, validatePaidOn } from './bill-validation';

/**
 * Records and reverts bill payments.
 *
 * "Exactly once" guarantee: an occurrence holds at most one payment (the
 * payment fields live on the occurrence row behind a CHECK invariant), and
 * the marking UPDATE is guarded by `status = 'pending'`. Repeating a
 * recording — double taps, retries, two callers racing — therefore cannot
 * create a second payment; it returns the already-recorded one unchanged.
 * The same guarantee covers the linked expense: `transactions.bill_occurrence_id`
 * is UNIQUE, so an occurrence can never be counted twice in the ledger.
 *
 * Note (master prompt severity rule 13): a recorded payment is a local
 * record only. Jibon never contacts the biller and never claims the bill was
 * paid through an external provider.
 */
export interface BillPaymentServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable local-date source for the default payment date. */
  nowDate?: () => Date;
  /** Injectable ID generator for the linked expense; defaults to a v4 UUID. */
  generateId?: () => string;
  /**
   * Accounts repository. Required only when a payment is recorded with an
   * `accountId` (so the linked expense can be validated); recordings without
   * an account work without it.
   */
  accounts?: AccountRepository;
}

export interface BillPaymentService {
  getOccurrence(id: string): Promise<BillDueItem>;
  /** Idempotent: recording an already-paid occurrence returns it unchanged. */
  recordPayment(occurrenceId: string, input?: RecordPaymentInput): Promise<BillDueItem>;
  /** Idempotent: reverting a pending occurrence is a no-op. */
  undoPayment(occurrenceId: string): Promise<BillDueItem>;
}

/**
 * Which expense category a bill payment is filed under. Maps the bill's
 * category onto the seeded finance categories (migration 003); everything
 * unmapped lands in `cat_expense_other` so a payment never fails to file.
 */
const BILL_EXPENSE_CATEGORY: Record<BillCategory, string> = {
  electricity: 'cat_expense_utilities',
  internet: 'cat_expense_utilities',
  water: 'cat_expense_utilities',
  gas: 'cat_expense_utilities',
  phone: 'cat_expense_utilities',
  rent: 'cat_expense_rent',
  credit_card: 'cat_expense_other',
  subscription: 'cat_expense_subscriptions',
  education: 'cat_expense_education',
  other: 'cat_expense_other',
};

export function expenseCategoryForBillCategory(category: BillCategory): string {
  return BILL_EXPENSE_CATEGORY[category] ?? 'cat_expense_other';
}

function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This bill no longer exists.');
}

export function createBillPaymentService(
  repo: BillRepository,
  deps: BillPaymentServiceDeps = {},
): BillPaymentService {
  const now = deps.now ?? nowIso;
  const nowDate = deps.nowDate ?? (() => new Date());
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<BillDueItem> {
    const occurrence = await repo.findOccurrenceById(id);
    if (!occurrence) {
      throw notFoundError();
    }
    return occurrence;
  }

  /**
   * Verifies the chosen account exists and still accepts activity. The
   * check runs before the payment transaction; the expense INSERT keeps the
   * FK guarantee regardless.
   */
  async function assertAccountAvailable(accountId: string): Promise<void> {
    if (!deps.accounts) {
      throw new AppError('validation', 'account_unavailable');
    }
    const account = await deps.accounts.findById(accountId);
    if (!account || account.isArchived) {
      throw new AppError('validation', 'account_unavailable');
    }
  }

  function linkedExpenseFor(
    occurrence: BillDueItem,
    accountId: string,
    amountMinor: number,
    paidOn: string,
    timestamp: string,
  ): Transaction {
    return {
      id: generateId(),
      kind: 'expense',
      amountMinor,
      accountId,
      categoryId: expenseCategoryForBillCategory(occurrence.billCategory),
      occurredOn: paidOn,
      description: occurrence.billName,
      recipient: null,
      notes: null,
      billOccurrenceId: occurrence.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  // Payment writes run one at a time through this queue. Concurrent calls
  // (double tap, retried submit) would otherwise both try to open the
  // exclusive write transaction; serializing them makes the second call see
  // the first call's committed state and turn into the idempotent no-op it
  // should be. The guarded UPDATE and the UNIQUE (bill_occurrence_id) index
  // remain the structural backstops for anything outside this instance.
  let writeQueue: Promise<unknown> = Promise.resolve();
  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = writeQueue.then(task, task);
    writeQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return {
    async getOccurrence(id: string): Promise<BillDueItem> {
      try {
        return await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') throw error;
        throw databaseError(error);
      }
    },

    async recordPayment(
      occurrenceId: string,
      input: RecordPaymentInput = {},
    ): Promise<BillDueItem> {
      return serialized(async () => {
        let existing: BillDueItem;
        try {
          existing = await loadExisting(occurrenceId);
        } catch (error) {
          if (error instanceof AppError && error.code === 'not_found') throw error;
          throw databaseError(error);
        }

        // Already paid: repeating the operation must not alter the original
        // payment (amount, date) nor create a second one. A payment recorded
        // without an account keeps its shape; undo + record again to relink.
        if (existing.status === 'paid') {
          return existing;
        }

        const paidAmountMinor = input.paidAmountMinor ?? existing.expectedAmountMinor;
        const amountError = validatePaidAmount(paidAmountMinor);
        if (amountError) throw new AppError('validation', amountError);

        const paidOn = input.paidOn ?? todayIsoDate(nowDate());
        const paidOnError = validatePaidOn(paidOn);
        if (paidOnError) throw new AppError('validation', paidOnError);

        const accountId = input.accountId ?? null;
        try {
          if (accountId !== null) {
            await assertAccountAvailable(accountId);
          }
        } catch (error) {
          if (error instanceof AppError) throw error;
          throw databaseError(error);
        }

        const timestamp = now();
        try {
          await repo.runInTransaction(async (txn) => {
            const marked = await txn.markPaidIfPending(existing.id, {
              paidAmountMinor,
              paidOn,
              updatedAt: timestamp,
            });
            // When the guarded update changed nothing, a concurrent caller
            // recorded the payment first — including its linked expense, if
            // any — so there is nothing left to file here.
            if (marked && accountId !== null) {
              await txn.insertLinkedExpense(
                linkedExpenseFor(existing, accountId, paidAmountMinor, paidOn, timestamp),
              );
            }
          });
          return await loadExisting(occurrenceId);
        } catch (error) {
          if (error instanceof AppError && error.code === 'not_found') throw error;
          throw databaseError(error);
        }
      });
    },

    async undoPayment(occurrenceId: string): Promise<BillDueItem> {
      return serialized(async () => {
        let existing: BillDueItem;
        try {
          existing = await loadExisting(occurrenceId);
        } catch (error) {
          if (error instanceof AppError && error.code === 'not_found') throw error;
          throw databaseError(error);
        }

        if (existing.status === 'pending') {
          return existing;
        }

        const timestamp = now();
        try {
          await repo.runInTransaction(async (txn) => {
            const reverted = await txn.markUnpaidIfPaid(existing.id, timestamp);
            // The linked expense (when the payment was recorded against an
            // account) is reversed in the same database transaction, so the
            // ledger and the bill can never disagree.
            if (reverted) {
              await txn.deleteLinkedExpense(existing.id);
            }
          });
          return await loadExisting(occurrenceId);
        } catch (error) {
          if (error instanceof AppError && error.code === 'not_found') throw error;
          throw databaseError(error);
        }
      });
    },
  };
}
