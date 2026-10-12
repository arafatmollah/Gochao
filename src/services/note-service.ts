import type { NoteRepository } from '@/db/repositories/note-repository';
import type {
  CreateNoteInput,
  Note,
  NoteCategory,
  NoteCategoryWithUsage,
  NoteListItem,
  NoteListOptions,
  NoteTag,
  UpdateNoteInput,
} from '@/types/note';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import {
  validateNoteBody,
  validateNoteCategoryName,
  validateNoteContentLength,
  validateNoteTitleLength,
  validateTagName,
} from './note-validation';

export interface NoteServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface NoteService {
  list(options?: NoteListOptions): Promise<NoteListItem[]>;
  count(): Promise<number>;
  getById(id: string): Promise<NoteListItem>;
  create(input: CreateNoteInput): Promise<Note>;
  update(id: string, input: UpdateNoteInput): Promise<Note>;
  /** Pinning reorders the list but is not a content edit (updated_at intact). */
  setPinned(id: string, isPinned: boolean): Promise<void>;
  /** Deletes the note and its tag links; tag rows themselves survive. */
  remove(id: string): Promise<void>;
  listCategories(): Promise<NoteCategoryWithUsage[]>;
  createCategory(name: string): Promise<NoteCategory>;
  /** Detaches the category from its notes; note content is never destroyed. */
  removeCategory(id: string): Promise<void>;
  listTags(): Promise<NoteTag[]>;
}

function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This note no longer exists.');
}

function validationError(code: string): AppError {
  return new AppError('validation', code);
}

export function createNoteService(
  repo: NoteRepository,
  deps: NoteServiceDeps = {},
): NoteService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function assertCategoryExists(categoryId: string): Promise<void> {
    const category = await repo.findCategoryById(categoryId);
    if (!category) {
      throw validationError('note_category_unavailable');
    }
  }

  /**
   * Trims, validates, and deduplicates tag names (case-insensitive), creating
   * missing tags on demand so a note save never fails on a new label.
   */
  async function resolveTagIds(tagNames: readonly string[]): Promise<string[]> {
    const seen = new Map<string, string>();
    const ids: string[] = [];
    for (const raw of tagNames) {
      const name = raw.trim();
      if (name.length === 0) {
        continue;
      }
      const error = validateTagName(name);
      if (error) {
        throw validationError(error);
      }
      const key = name.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      let tag = await repo.findTagByName(name);
      if (!tag) {
        tag = { id: generateId(), name, createdAt: now() };
        await repo.insertTag(tag);
      }
      seen.set(key, tag.id);
      ids.push(tag.id);
    }
    return ids;
  }

  return {
    async list(options = {}) {
      try {
        return await repo.list(options);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async count() {
      try {
        return await repo.count();
      } catch (error) {
        throw databaseError(error);
      }
    },

    async getById(id) {
      try {
        const note = await repo.findById(id);
        if (!note) {
          throw notFoundError();
        }
        return note;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async create(input) {
      const title = input.title.trim();
      const content = input.content.trim();

      const bodyError = validateNoteBody(title, content);
      if (bodyError) throw validationError(bodyError);
      const titleError = validateNoteTitleLength(title);
      if (titleError) throw validationError(titleError);
      const contentError = validateNoteContentLength(content);
      if (contentError) throw validationError(contentError);

      const categoryId = input.categoryId ?? null;
      const tagIds = input.tagNames ? await resolveTagIds(input.tagNames) : [];
      const timestamp = now();
      const note: Note = {
        id: generateId(),
        title,
        content,
        categoryId,
        isPinned: input.isPinned ?? false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        if (categoryId) {
          await assertCategoryExists(categoryId);
        }
        await repo.insertWithTags(note, tagIds);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }
      return note;
    },

    async update(id, input) {
      let existing: NoteListItem;
      try {
        const found = await repo.findById(id);
        if (!found) {
          throw notFoundError();
        }
        existing = found;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      const title = input.title === undefined ? existing.title : input.title.trim();
      const content = input.content === undefined ? existing.content : input.content.trim();

      const bodyError = validateNoteBody(title, content);
      if (bodyError) throw validationError(bodyError);
      const titleError = validateNoteTitleLength(title);
      if (titleError) throw validationError(titleError);
      const contentError = validateNoteContentLength(content);
      if (contentError) throw validationError(contentError);

      const categoryId = input.categoryId === undefined ? existing.categoryId : input.categoryId;

      const updated: Note = {
        id: existing.id,
        title,
        content,
        categoryId,
        isPinned: input.isPinned ?? existing.isPinned,
        createdAt: existing.createdAt,
        updatedAt: now(),
      };
      const replaceTags = input.tagNames !== undefined;
      const tagIds = replaceTags ? await resolveTagIds(input.tagNames ?? []) : [];

      try {
        if (categoryId) {
          await assertCategoryExists(categoryId);
        }
        if (replaceTags) {
          await repo.updateWithTags(updated, tagIds);
        } else {
          await repo.update(updated);
        }
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }
      return updated;
    },

    async setPinned(id, isPinned) {
      try {
        const changed = await repo.setPinned(id, isPinned);
        if (!changed) {
          throw notFoundError();
        }
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async remove(id) {
      try {
        const deleted = await repo.delete(id);
        if (!deleted) {
          throw notFoundError();
        }
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async listCategories() {
      try {
        return await repo.listCategories();
      } catch (error) {
        throw databaseError(error);
      }
    },

    async createCategory(name) {
      const nameError = validateNoteCategoryName(name);
      if (nameError) throw validationError(nameError);
      const trimmed = name.trim();
      const category: NoteCategory = { id: generateId(), name: trimmed, createdAt: now() };
      try {
        const existing = await repo.findCategoryByName(trimmed);
        if (existing) {
          throw new AppError('conflict', 'note_category_name_taken');
        }
        await repo.insertCategory(category);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }
      return category;
    },

    async removeCategory(id) {
      try {
        const deleted = await repo.deleteCategory(id);
        if (!deleted) {
          throw notFoundError();
        }
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async listTags() {
      try {
        return await repo.listTags();
      } catch (error) {
        throw databaseError(error);
      }
    },
  };
}
