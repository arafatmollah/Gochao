import type { GroceryRepository } from '@/db/repositories/grocery-repository';
import type {
  CreateGroceryItemInput,
  CreateGroceryListInput,
  GroceryItem,
  GroceryItemFilter,
  GroceryItemWithMember,
  GroceryList,
  GroceryListFilter,
  GroceryListSummary,
  UpdateGroceryItemInput,
  UpdateGroceryListInput,
} from '@/types/grocery';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import type { GroceryValidationCode } from './grocery-validation';
import {
  validateGroceryItemName,
  validateGroceryListName,
  validateGroceryNotes,
  validateGroceryPrice,
  validateGroceryQuantity,
  validateGroceryUnit,
} from './grocery-validation';

export interface GroceryServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface GroceryService {
  listSummaries(filter?: GroceryListFilter): Promise<GroceryListSummary[]>;
  getListById(id: string): Promise<GroceryList>;
  createList(input: CreateGroceryListInput): Promise<GroceryList>;
  updateList(id: string, input: UpdateGroceryListInput): Promise<GroceryList>;
  /** Archives (or unarchives) a list. Archived lists are the shopping history. */
  setArchived(id: string, archived: boolean): Promise<GroceryList>;
  removeList(id: string): Promise<void>;

  listItems(listId: string, filter?: GroceryItemFilter): Promise<GroceryItemWithMember[]>;
  countRemaining(listId: string): Promise<number>;
  countItems(listId: string): Promise<number>;
  /** List-wide price totals, independent of any item display filter. */
  sumTotals(listId: string): Promise<{ estimatedTotalMinor: number; actualTotalMinor: number }>;
  getItemById(id: string): Promise<GroceryItemWithMember>;
  createItem(listId: string, input: CreateGroceryItemInput): Promise<GroceryItem>;
  updateItem(id: string, input: UpdateGroceryItemInput): Promise<GroceryItem>;
  /** Checks off or reopens an item. Idempotent: repeating a transition is safe. */
  setPurchased(id: string, purchased: boolean): Promise<GroceryItem>;
  removeItem(id: string): Promise<void>;

  listActiveMembers(): Promise<{ id: string; name: string }[]>;
}

/** Wraps unexpected storage failures; never leaks SQL or record contents. */
function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function listNotFoundError(): AppError {
  return new AppError('not_found', 'This grocery list no longer exists.');
}

function itemNotFoundError(): AppError {
  return new AppError('not_found', 'This grocery item no longer exists.');
}

function validationError(code: GroceryValidationCode): AppError {
  return new AppError('validation', code);
}

function normalizeNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUnit(unit: string | null | undefined): string | null {
  const trimmed = unit?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function createGroceryService(
  repo: GroceryRepository,
  deps: GroceryServiceDeps = {},
): GroceryService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function loadList(id: string): Promise<GroceryList> {
    const list = await repo.findListById(id);
    if (!list) {
      throw listNotFoundError();
    }
    return list;
  }

  async function loadItem(id: string): Promise<GroceryItem> {
    const item = await repo.findItemById(id);
    if (!item) {
      throw itemNotFoundError();
    }
    return item;
  }

  async function assertMemberExists(memberId: string | null): Promise<void> {
    if (memberId === null) {
      return;
    }
    let exists: boolean;
    try {
      exists = await repo.memberExists(memberId);
    } catch (error) {
      throw databaseError(error);
    }
    if (!exists) {
      throw validationError('grocery_member_invalid');
    }
  }

  function assertValidListFields(name: string, notes: string | null | undefined): {
    trimmedName: string;
    normalizedNotes: string | null;
  } {
    const nameError = validateGroceryListName(name);
    if (nameError) {
      throw validationError(nameError);
    }
    const notesError = validateGroceryNotes(notes);
    if (notesError) {
      throw validationError(notesError);
    }
    return { trimmedName: name.trim(), normalizedNotes: normalizeNotes(notes) };
  }

  function assertValidItemFields(input: {
    name: string;
    quantity: number;
    unit: string | null | undefined;
    estimatedPriceMinor: number | null | undefined;
    actualPriceMinor: number | null | undefined;
    notes: string | null | undefined;
  }): void {
    const nameError = validateGroceryItemName(input.name);
    if (nameError) {
      throw validationError(nameError);
    }
    const quantityError = validateGroceryQuantity(input.quantity);
    if (quantityError) {
      throw validationError(quantityError);
    }
    const unitError = validateGroceryUnit(input.unit);
    if (unitError) {
      throw validationError(unitError);
    }
    const estimatedError = validateGroceryPrice(input.estimatedPriceMinor);
    if (estimatedError) {
      throw validationError(estimatedError);
    }
    const actualError = validateGroceryPrice(input.actualPriceMinor);
    if (actualError) {
      throw validationError(actualError);
    }
    const notesError = validateGroceryNotes(input.notes);
    if (notesError) {
      throw validationError(notesError);
    }
  }

  return {
    async listSummaries(filter: GroceryListFilter = {}): Promise<GroceryListSummary[]> {
      try {
        return await repo.listSummaries(filter);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async getListById(id: string): Promise<GroceryList> {
      try {
        return await loadList(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async createList(input: CreateGroceryListInput): Promise<GroceryList> {
      const { trimmedName, normalizedNotes } = assertValidListFields(input.name, input.notes);

      const timestamp = now();
      const list: GroceryList = {
        id: generateId(),
        name: trimmedName,
        notes: normalizedNotes,
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await repo.insertList(list);
      } catch (error) {
        throw databaseError(error);
      }
      return list;
    },

    async updateList(id: string, input: UpdateGroceryListInput): Promise<GroceryList> {
      let existing: GroceryList;
      try {
        existing = await loadList(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      const name = input.name === undefined ? existing.name : input.name;
      const notes = input.notes === undefined ? existing.notes : input.notes;
      const { trimmedName, normalizedNotes } = assertValidListFields(name, notes);

      const updated: GroceryList = {
        ...existing,
        name: trimmedName,
        notes: normalizedNotes,
        updatedAt: now(),
      };

      try {
        await repo.updateList(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async setArchived(id: string, archived: boolean): Promise<GroceryList> {
      let existing: GroceryList;
      try {
        existing = await loadList(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      if (existing.isArchived === archived) {
        return existing;
      }

      const updated: GroceryList = { ...existing, isArchived: archived, updatedAt: now() };
      try {
        await repo.updateList(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async removeList(id: string): Promise<void> {
      let deleted: boolean;
      try {
        deleted = await repo.deleteList(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (!deleted) {
        throw listNotFoundError();
      }
    },

    async listItems(listId: string, filter: GroceryItemFilter = {}): Promise<GroceryItemWithMember[]> {
      try {
        await loadList(listId);
        return await repo.listItems(listId, filter);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async countRemaining(listId: string): Promise<number> {
      try {
        return await repo.countRemaining(listId);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async countItems(listId: string): Promise<number> {
      try {
        return await repo.countItems(listId);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async sumTotals(
      listId: string,
    ): Promise<{ estimatedTotalMinor: number; actualTotalMinor: number }> {
      try {
        return await repo.sumTotals(listId);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async getItemById(id: string): Promise<GroceryItemWithMember> {
      try {
        const item = await repo.findItemById(id);
        if (!item) {
          throw itemNotFoundError();
        }
        return item;
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async createItem(listId: string, input: CreateGroceryItemInput): Promise<GroceryItem> {
      let list: GroceryList;
      try {
        list = await loadList(listId);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      const quantity = input.quantity ?? 1;
      assertValidItemFields({
        name: input.name,
        quantity,
        unit: input.unit,
        estimatedPriceMinor: input.estimatedPriceMinor,
        actualPriceMinor: input.actualPriceMinor,
        notes: input.notes,
      });
      await assertMemberExists(input.assignedMemberId ?? null);

      const timestamp = now();
      const item: GroceryItem = {
        id: generateId(),
        listId: list.id,
        name: input.name.trim(),
        quantity,
        unit: normalizeUnit(input.unit),
        estimatedPriceMinor: input.estimatedPriceMinor ?? null,
        actualPriceMinor: input.actualPriceMinor ?? null,
        isPurchased: false,
        purchasedAt: null,
        assignedMemberId: input.assignedMemberId ?? null,
        notes: normalizeNotes(input.notes),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await repo.insertItem(item);
      } catch (error) {
        throw databaseError(error);
      }
      return item;
    },

    async updateItem(id: string, input: UpdateGroceryItemInput): Promise<GroceryItem> {
      let existing: GroceryItem;
      try {
        existing = await loadItem(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      const name = input.name === undefined ? existing.name : input.name;
      const quantity = input.quantity === undefined ? existing.quantity : input.quantity;
      const unit = input.unit === undefined ? existing.unit : input.unit;
      const estimatedPriceMinor =
        input.estimatedPriceMinor === undefined ? existing.estimatedPriceMinor : input.estimatedPriceMinor;
      const actualPriceMinor =
        input.actualPriceMinor === undefined ? existing.actualPriceMinor : input.actualPriceMinor;
      const notes = input.notes === undefined ? existing.notes : input.notes;
      const assignedMemberId =
        input.assignedMemberId === undefined ? existing.assignedMemberId : input.assignedMemberId;

      assertValidItemFields({ name, quantity, unit, estimatedPriceMinor, actualPriceMinor, notes });
      await assertMemberExists(assignedMemberId);

      const updated: GroceryItem = {
        ...existing,
        name: name.trim(),
        quantity,
        unit: normalizeUnit(unit),
        estimatedPriceMinor,
        actualPriceMinor,
        assignedMemberId,
        notes: normalizeNotes(notes),
        updatedAt: now(),
      };

      try {
        await repo.updateItem(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async setPurchased(id: string, purchased: boolean): Promise<GroceryItem> {
      let existing: GroceryItem;
      try {
        existing = await loadItem(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      if (purchased === existing.isPurchased) {
        return existing;
      }

      const timestamp = now();
      const updated: GroceryItem = purchased
        ? { ...existing, isPurchased: true, purchasedAt: timestamp, updatedAt: timestamp }
        : { ...existing, isPurchased: false, purchasedAt: null, updatedAt: timestamp };

      try {
        await repo.updateItem(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async removeItem(id: string): Promise<void> {
      let deleted: boolean;
      try {
        deleted = await repo.deleteItem(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (!deleted) {
        throw itemNotFoundError();
      }
    },

    async listActiveMembers(): Promise<{ id: string; name: string }[]> {
      try {
        return await repo.listActiveMembers();
      } catch (error) {
        throw databaseError(error);
      }
    },
  };
}
