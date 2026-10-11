import type { AccountRepository } from '@/db/repositories/account-repository';
import type {
  Account,
  AccountWithBalance,
  CreateAccountInput,
  UpdateAccountInput,
} from '@/types/finance';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import {
  amountError,
  asAccountType,
  validateAccountName,
  validateAccountType,
} from './finance-validation';

const DEFAULT_CURRENCY = 'BDT';

export interface AccountServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface AccountService {
  list(options?: { includeArchived?: boolean }): Promise<Account[]>;
  /** Accounts with derived balances (`opening + income − expenses ± transfers`). */
  listWithBalances(options?: { includeArchived?: boolean }): Promise<AccountWithBalance[]>;
  getById(id: string): Promise<Account>;
  create(input: CreateAccountInput): Promise<Account>;
  update(id: string, input: UpdateAccountInput): Promise<Account>;
  /** Archiving keeps the full history but blocks new transactions (rule 10). */
  setArchived(id: string, archived: boolean): Promise<Account>;
  /** Deletes only accounts with no records; otherwise conflicts. */
  remove(id: string): Promise<void>;
}

function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This account no longer exists.');
}

function validationError(code: string): AppError {
  return new AppError('validation', code);
}

export function createAccountService(
  repo: AccountRepository,
  deps: AccountServiceDeps = {},
): AccountService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<Account> {
    const account = await repo.findById(id);
    if (!account) {
      throw notFoundError();
    }
    return account;
  }

  async function assertNameFree(name: string, selfId: string | null): Promise<void> {
    const existing = await repo.findByName(name);
    if (existing && existing.id !== selfId) {
      throw new AppError('conflict', 'account_name_taken');
    }
  }

  return {
    async list(options = {}) {
      try {
        return await repo.list(options);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async listWithBalances(options = {}) {
      try {
        return await repo.listWithBalances(options);
      } catch (error) {
        throw databaseError(error);
      }
    },

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

    async create(input: CreateAccountInput): Promise<Account> {
      const nameError = validateAccountName(input.name);
      if (nameError) throw validationError(nameError);
      const typeError = validateAccountType(input.type);
      if (typeError) throw validationError(typeError);
      const openingBalanceMinor = input.openingBalanceMinor ?? 0;
      const balanceError = amountError(openingBalanceMinor, 'account_opening_balance_invalid', {
        allowZero: true,
      });
      if (balanceError) throw validationError(balanceError);

      const name = input.name.trim();
      const timestamp = now();
      const account: Account = {
        id: generateId(),
        name,
        type: input.type,
        currency: input.currency?.trim() || DEFAULT_CURRENCY,
        openingBalanceMinor,
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await assertNameFree(name, null);
        await repo.insert(account);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }
      return account;
    },

    async update(id: string, input: UpdateAccountInput): Promise<Account> {
      let existing: Account;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }

      const name = input.name === undefined ? existing.name : input.name.trim();
      const nameError = validateAccountName(name);
      if (nameError) throw validationError(nameError);

      const type =
        input.type === undefined ? existing.type : asAccountType(input.type);
      const typeError = validateAccountType(type);
      if (typeError) throw validationError(typeError);

      const openingBalanceMinor = input.openingBalanceMinor ?? existing.openingBalanceMinor;
      const balanceError = amountError(openingBalanceMinor, 'account_opening_balance_invalid', {
        allowZero: true,
      });
      if (balanceError) throw validationError(balanceError);

      const updated: Account = {
        ...existing,
        name,
        type,
        openingBalanceMinor,
        isArchived: input.isArchived ?? existing.isArchived,
        updatedAt: now(),
      };

      try {
        if (name !== existing.name) {
          await assertNameFree(name, id);
        }
        await repo.update(updated);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }
      return updated;
    },

    async setArchived(id: string, archived: boolean): Promise<Account> {
      let existing: Account;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }
      if (existing.isArchived === archived) {
        return existing;
      }
      const updated: Account = { ...existing, isArchived: archived, updatedAt: now() };
      try {
        await repo.update(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async remove(id: string): Promise<void> {
      let deleted: boolean;
      try {
        deleted = await repo.deleteIfUnused(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (deleted) {
        return;
      }
      // Either the account is gone (already deleted elsewhere), or it has
      // transaction/transfer history that must survive (rule 10).
      let existing: Account | null;
      try {
        existing = await repo.findById(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (!existing) {
        throw notFoundError();
      }
      throw new AppError('conflict', 'account_in_use');
    },
  };
}
