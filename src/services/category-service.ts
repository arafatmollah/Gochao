import type {
  CategoryListOptions,
  CategoryRepository,
} from '@/db/repositories/category-repository';
import type {
  Category,
  CategoryWithUsage,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@/types/finance';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import { validateCategoryKind, validateCategoryName } from './finance-validation';

/** Custom categories sort after the seeded built-ins (which use 1..n). */
const CUSTOM_SORT_ORDER = 999;

export interface CategoryServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface CategoryService {
  list(options?: CategoryListOptions): Promise<Category[]>;
  listWithUsage(options?: CategoryListOptions): Promise<CategoryWithUsage[]>;
  getById(id: string): Promise<Category>;
  create(input: CreateCategoryInput): Promise<Category>;
  update(id: string, input: UpdateCategoryInput): Promise<Category>;
  /**
   * Deletes a custom, unused category. Built-ins and in-use categories are
   * protected; never destroys transaction history (rule 10).
   */
  remove(id: string): Promise<void>;
}

function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This category no longer exists.');
}

function validationError(code: string): AppError {
  return new AppError('validation', code);
}

export function createCategoryService(
  repo: CategoryRepository,
  deps: CategoryServiceDeps = {},
): CategoryService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<Category> {
    const category = await repo.findById(id);
    if (!category) {
      throw notFoundError();
    }
    return category;
  }

  async function assertNameFree(kind: Category['kind'], name: string, selfId: string | null): Promise<void> {
    const existing = await repo.findByKindAndName(kind, name);
    if (existing && existing.id !== selfId) {
      throw new AppError('conflict', 'category_name_taken');
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

    async listWithUsage(options = {}) {
      try {
        return await repo.listWithUsage(options);
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

    async create(input: CreateCategoryInput): Promise<Category> {
      const kindError = validateCategoryKind(input.kind);
      if (kindError) throw validationError(kindError);
      const nameError = validateCategoryName(input.name);
      if (nameError) throw validationError(nameError);

      const name = input.name.trim();
      const timestamp = now();
      const category: Category = {
        id: generateId(),
        kind: input.kind,
        name,
        isBuiltin: false,
        isArchived: false,
        sortOrder: CUSTOM_SORT_ORDER,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await assertNameFree(input.kind, name, null);
        await repo.insert(category);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }
      return category;
    },

    async update(id: string, input: UpdateCategoryInput): Promise<Category> {
      let existing: Category;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }

      // Built-in display names are translated by id; renaming one would have
      // no visible effect, so it is rejected instead of silently ignored.
      if (input.name !== undefined && existing.isBuiltin) {
        const trimmed = input.name.trim();
        if (trimmed !== existing.name) {
          throw new AppError('conflict', 'category_builtin');
        }
      }

      const name = input.name === undefined ? existing.name : input.name.trim();
      const nameError = validateCategoryName(name);
      if (nameError) throw validationError(nameError);

      const updated: Category = {
        ...existing,
        name,
        isArchived: input.isArchived ?? existing.isArchived,
        updatedAt: now(),
      };

      try {
        if (name !== existing.name) {
          await assertNameFree(existing.kind, name, id);
        }
        await repo.update(updated);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw databaseError(error);
      }
      return updated;
    },

    async remove(id: string): Promise<void> {
      let existing: Category | null;
      try {
        existing = await repo.findById(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (!existing) {
        throw notFoundError();
      }
      if (existing.isBuiltin) {
        throw new AppError('conflict', 'category_builtin');
      }

      let deleted: boolean;
      try {
        deleted = await repo.deleteIfUnused(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (!deleted) {
        // The row exists (checked above) and is not built-in, so the only
        // reason deleteIfUnused refused is recorded usage (rule 10).
        throw new AppError('conflict', 'category_in_use');
      }
    },
  };
}
