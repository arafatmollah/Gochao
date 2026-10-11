import type { AccountRepository } from '@/db/repositories/account-repository';
import type { CategoryRepository } from '@/db/repositories/category-repository';
import type { TransactionRepository } from '@/db/repositories/transaction-repository';
import type {
  ActivityFilter,
  ActivityRow,
  CategoryTotal,
  CreateTransactionInput,
  FinanceTotals,
  MonthNetItem,
  Transaction,
  TransactionKind,
  UpdateTransactionInput,
} from '@/types/finance';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import {
  amountError,
  validateOccurredOn,
  validateRecipient,
  validateTransactionDescription,
  validateTransactionKind,
  validateTransactionNotes,
} from './finance-validation';

export interface TransactionServiceDeps {
  accounts: AccountRepository;
  categories: CategoryRepository;
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface TransactionService {
  getById(id: string): Promise<Transaction>;
  create(input: CreateTransactionInput): Promise<Transaction>;
  /** `kind` and timestamps are immutable; bill-linked expenses are locked. */
  update(id: string, input: UpdateTransactionInput): Promise<Transaction>;
  /** Bill-linked expenses are reversed from the bill screen, not deleted here. */
  remove(id: string): Promise<void>;
  /** Unified income/expense/transfer feed, newest first. */
  listActivity(filter?: ActivityFilter): Promise<ActivityRow[]>;
  /** Income/expense totals for the same filters; transfers always excluded. */
  sumActivity(filter?: ActivityFilter): Promise<FinanceTotals>;
  /** Totals grouped by category, largest first. */
  sumByCategory(options: {
    kind: TransactionKind;
    fromOn: string;
    toOn: string;
  }): Promise<CategoryTotal[]>;
  /** Per-month income/expense/net series within [fromOn, nextStartOn). */
  monthTotals(options: { fromOn: string; nextStartOn: string }): Promise<MonthNetItem[]>;
}

function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This transaction no longer exists.');
}

function validationError(code: string): AppError {
  return new AppError('validation', code);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function createTransactionService(
  repo: TransactionRepository,
  deps: TransactionServiceDeps,
): TransactionService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<Transaction> {
    const transaction = await repo.findById(id);
    if (!transaction) {
      throw notFoundError();
    }
    return transaction;
  }

  /**
   * An account is available when it exists and is not archived. Editing a
   * record that already sits on an archived account stays allowed (the
   * record predates archiving; moving it elsewhere is also fine).
   */
  async function assertAccountAvailable(accountId: string, allowedId: string | null): Promise<void> {
    const account = await deps.accounts.findById(accountId);
    if (!account || (account.isArchived && account.id !== allowedId)) {
      throw validationError('account_unavailable');
    }
  }

  /** Same availability rule as accounts: the category must exist, match the
   * transaction kind, and not be archived (unless it is the record's own). */
  async function assertCategoryAvailable(
    categoryId: string,
    kind: TransactionKind,
    allowedId: string | null,
  ): Promise<void> {
    const category = await deps.categories.findById(categoryId);
    if (!category || category.kind !== kind || (category.isArchived && category.id !== allowedId)) {
      throw validationError('category_unavailable');
    }
  }

  return {
    async getById(id) {
      try {
        return await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async create(input: CreateTransactionInput): Promise<Transaction> {
      const kindError = validateTransactionKind(input.kind);
      if (kindError) throw validationError(kindError);
      const amountErr = amountError(input.amountMinor, 'transaction_amount_invalid');
      if (amountErr) throw validationError(amountErr);
      const dateError = validateOccurredOn(input.occurredOn, 'transaction_date_invalid');
      if (dateError) throw validationError(dateError);
      const descriptionError = validateTransactionDescription(input.description);
      if (descriptionError) throw validationError(descriptionError);
      const recipientError = validateRecipient(input.recipient);
      if (recipientError) throw validationError(recipientError);
      const notes = normalizeOptionalText(input.notes);
      const notesError = validateTransactionNotes(notes);
      if (notesError) throw validationError(notesError);

      const timestamp = now();
      const transaction: Transaction = {
        id: generateId(),
        kind: input.kind,
        amountMinor: input.amountMinor,
        accountId: input.accountId,
        categoryId: input.categoryId,
        occurredOn: input.occurredOn,
        description: input.description.trim(),
        recipient: normalizeOptionalText(input.recipient),
        notes,
        billOccurrenceId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await assertAccountAvailable(input.accountId, null);
        await assertCategoryAvailable(input.categoryId, input.kind, null);
        await repo.insert(transaction);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }
      return transaction;
    },

    async update(id: string, input: UpdateTransactionInput): Promise<Transaction> {
      let existing: Transaction;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }

      // Expenses created by a bill payment mirror that payment: editing one
      // here would silently desync the bill history. The bill screen's
      // undo-payment path reverses them atomically instead.
      if (existing.billOccurrenceId !== null) {
        throw new AppError('conflict', 'transaction_linked_to_bill');
      }

      const amountMinor = input.amountMinor ?? existing.amountMinor;
      const amountErr = amountError(amountMinor, 'transaction_amount_invalid');
      if (amountErr) throw validationError(amountErr);

      const accountId = input.accountId ?? existing.accountId;
      const categoryId = input.categoryId ?? existing.categoryId;
      const occurredOn = input.occurredOn ?? existing.occurredOn;
      const dateError = validateOccurredOn(occurredOn, 'transaction_date_invalid');
      if (dateError) throw validationError(dateError);

      const description =
        input.description === undefined ? existing.description : input.description.trim();
      const descriptionError = validateTransactionDescription(description);
      if (descriptionError) throw validationError(descriptionError);

      const recipient =
        input.recipient === undefined ? existing.recipient : normalizeOptionalText(input.recipient);
      const recipientError = validateRecipient(recipient);
      if (recipientError) throw validationError(recipientError);

      const notes = input.notes === undefined ? existing.notes : normalizeOptionalText(input.notes);
      const notesError = validateTransactionNotes(notes);
      if (notesError) throw validationError(notesError);

      const updated: Transaction = {
        ...existing,
        amountMinor,
        accountId,
        categoryId,
        occurredOn,
        description,
        recipient,
        notes,
        updatedAt: now(),
      };

      try {
        await assertAccountAvailable(accountId, existing.accountId);
        await assertCategoryAvailable(categoryId, existing.kind, existing.categoryId);
        await repo.update(updated);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }
      return updated;
    },

    async remove(id: string): Promise<void> {
      let existing: Transaction;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }
      if (existing.billOccurrenceId !== null) {
        throw new AppError('conflict', 'transaction_linked_to_bill');
      }
      let deleted: boolean;
      try {
        deleted = await repo.delete(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (!deleted) {
        throw notFoundError();
      }
    },

    async listActivity(filter = {}) {
      try {
        return await repo.listActivity(filter);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async sumActivity(filter = {}) {
      try {
        const { incomeMinor, expenseMinor } = await repo.sumActivity(filter);
        return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor };
      } catch (error) {
        throw databaseError(error);
      }
    },

    async sumByCategory(options) {
      try {
        return await repo.sumByCategory(options);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async monthTotals(options) {
      try {
        return await repo.monthTotals(options);
      } catch (error) {
        throw databaseError(error);
      }
    },
  };
}
