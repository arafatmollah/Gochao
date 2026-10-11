import type { BudgetRepository } from '@/db/repositories/budget-repository';
import type { CategoryRepository } from '@/db/repositories/category-repository';
import type { Budget, BudgetWithUsage, CreateBudgetInput } from '@/types/finance';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import { amountError } from './finance-validation';

export interface BudgetServiceDeps {
  categories: CategoryRepository;
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface BudgetService {
  getById(id: string): Promise<Budget>;
  /** Monthly budgets with derived spent figures for the queried month. */
  listWithUsage(options: { startOn: string; nextStartOn: string }): Promise<BudgetWithUsage[]>;
  create(input: CreateBudgetInput): Promise<Budget>;
  update(id: string, input: { amountMinor: number }): Promise<Budget>;
  remove(id: string): Promise<void>;
}

function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This budget no longer exists.');
}

function validationError(code: string): AppError {
  return new AppError('validation', code);
}

export function createBudgetService(
  repo: BudgetRepository,
  deps: BudgetServiceDeps,
): BudgetService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<Budget> {
    const budget = await repo.findById(id);
    if (!budget) {
      throw notFoundError();
    }
    return budget;
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

    async listWithUsage(options) {
      try {
        return await repo.listWithUsage(options);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async create(input: CreateBudgetInput): Promise<Budget> {
      const amountErr = amountError(input.amountMinor, 'budget_amount_invalid');
      if (amountErr) throw validationError(amountErr);

      let category;
      try {
        category = await deps.categories.findById(input.categoryId);
      } catch (error) {
        throw databaseError(error);
      }
      // Budgets exist for spending only, and never for archived categories.
      if (!category || category.kind !== 'expense' || category.isArchived) {
        throw validationError('budget_category_invalid');
      }

      let existingForCategory: Budget | null;
      try {
        existingForCategory = await repo.findByCategoryId(input.categoryId);
      } catch (error) {
        throw databaseError(error);
      }
      if (existingForCategory) {
        throw new AppError('conflict', 'budget_exists');
      }

      const timestamp = now();
      const budget: Budget = {
        id: generateId(),
        categoryId: input.categoryId,
        amountMinor: input.amountMinor,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      try {
        await repo.insert(budget);
      } catch (error) {
        throw databaseError(error);
      }
      return budget;
    },

    async update(id: string, input: { amountMinor: number }): Promise<Budget> {
      let existing: Budget;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }
      const amountErr = amountError(input.amountMinor, 'budget_amount_invalid');
      if (amountErr) throw validationError(amountErr);

      const updated: Budget = { ...existing, amountMinor: input.amountMinor, updatedAt: now() };
      try {
        await repo.update(updated);
      } catch (error) {
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
