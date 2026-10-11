import type { AccountRepository } from '@/db/repositories/account-repository';
import type { TransferRepository } from '@/db/repositories/transfer-repository';
import type { CreateTransferInput, Transfer, UpdateTransferInput } from '@/types/finance';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import {
  amountError,
  validateOccurredOn,
  validateTransferAccounts,
  validateTransferNotes,
} from './finance-validation';

export interface TransferServiceDeps {
  accounts: AccountRepository;
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface TransferService {
  getById(id: string): Promise<Transfer>;
  /** Creates the single-row move; both sides written together (rule 11 safe). */
  create(input: CreateTransferInput): Promise<Transfer>;
  update(id: string, input: UpdateTransferInput): Promise<Transfer>;
  remove(id: string): Promise<void>;
}

function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This transfer no longer exists.');
}

function validationError(code: string): AppError {
  return new AppError('validation', code);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function createTransferService(
  repo: TransferRepository,
  deps: TransferServiceDeps,
): TransferService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<Transfer> {
    const transfer = await repo.findById(id);
    if (!transfer) {
      throw notFoundError();
    }
    return transfer;
  }

  /** Archived accounts accept no new activity; existing rows may stay put. */
  async function assertAccountAvailable(accountId: string, allowedId: string | null): Promise<void> {
    const account = await deps.accounts.findById(accountId);
    if (!account || (account.isArchived && account.id !== allowedId)) {
      throw validationError('account_unavailable');
    }
  }

  function assertValidAmount(amountMinor: number | null | undefined): void {
    const err = amountError(amountMinor, 'transfer_amount_invalid');
    if (err) throw validationError(err);
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

    async create(input: CreateTransferInput): Promise<Transfer> {
      assertValidAmount(input.amountMinor);
      const accountsError = validateTransferAccounts(input.fromAccountId, input.toAccountId);
      if (accountsError) throw validationError(accountsError);
      const dateError = validateOccurredOn(input.occurredOn, 'transfer_date_invalid');
      if (dateError) throw validationError(dateError);
      const notes = normalizeOptionalText(input.notes);
      const notesError = validateTransferNotes(notes);
      if (notesError) throw validationError(notesError);

      const timestamp = now();
      const transfer: Transfer = {
        id: generateId(),
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amountMinor: input.amountMinor,
        occurredOn: input.occurredOn,
        notes,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await assertAccountAvailable(input.fromAccountId, null);
        await assertAccountAvailable(input.toAccountId, null);
        await repo.insert(transfer);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }
      return transfer;
    },

    async update(id: string, input: UpdateTransferInput): Promise<Transfer> {
      let existing: Transfer;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }

      const fromAccountId = input.fromAccountId ?? existing.fromAccountId;
      const toAccountId = input.toAccountId ?? existing.toAccountId;
      const accountsError = validateTransferAccounts(fromAccountId, toAccountId);
      if (accountsError) throw validationError(accountsError);

      const amountMinor = input.amountMinor ?? existing.amountMinor;
      assertValidAmount(amountMinor);

      const occurredOn = input.occurredOn ?? existing.occurredOn;
      const dateError = validateOccurredOn(occurredOn, 'transfer_date_invalid');
      if (dateError) throw validationError(dateError);

      const notes = input.notes === undefined ? existing.notes : normalizeOptionalText(input.notes);
      const notesError = validateTransferNotes(notes);
      if (notesError) throw validationError(notesError);

      const updated: Transfer = {
        ...existing,
        fromAccountId,
        toAccountId,
        amountMinor,
        occurredOn,
        notes,
        updatedAt: now(),
      };

      try {
        await assertAccountAvailable(fromAccountId, existing.fromAccountId);
        await assertAccountAvailable(toAccountId, existing.toAccountId);
        await repo.update(updated);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }
      return updated;
    },

    async remove(id: string): Promise<void> {
      try {
        await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
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
  };
}
