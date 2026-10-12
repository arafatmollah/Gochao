import type { WatchlistRepository } from '@/db/repositories/entertainment-repository';
import type {
  CreateWatchItemInput,
  UpdateWatchItemInput,
  WatchFilter,
  WatchItem,
  WatchKind,
  WatchStatus,
} from '@/types/entertainment';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import type { EntertainmentValidationCode } from './entertainment-validation';
import {
  validateWatchKind,
  validateWatchNotes,
  validateWatchRating,
  validateWatchStatus,
  validateWatchTitle,
  validateWatchUrl,
} from './entertainment-validation';

export interface EntertainmentServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface EntertainmentService {
  list(filter?: WatchFilter): Promise<WatchItem[]>;
  getById(id: string): Promise<WatchItem>;
  create(input: CreateWatchItemInput): Promise<WatchItem>;
  update(id: string, input: UpdateWatchItemInput): Promise<WatchItem>;
  /** Moves an item between lists. Idempotent. */
  setStatus(id: string, status: WatchStatus): Promise<WatchItem>;
  /** Rates 1–5, or clears the rating with null. */
  setRating(id: string, rating: number | null): Promise<WatchItem>;
  remove(id: string): Promise<void>;
  /**
   * Saves a spotlight entry unless the same title is already saved (matched
   * case-insensitively per kind) — then returns the existing row instead of
   * duplicating it. Reports whether a new row was created.
   */
  saveSpotlight(title: string, kind: WatchKind): Promise<{ item: WatchItem; created: boolean }>;
}

/** Wraps unexpected storage failures; never leaks SQL or record contents. */
function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This saved title no longer exists.');
}

function validationError(code: EntertainmentValidationCode): AppError {
  return new AppError('validation', code);
}

function normalizeUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function createEntertainmentService(
  repo: WatchlistRepository,
  deps: EntertainmentServiceDeps = {},
): EntertainmentService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<WatchItem> {
    const item = await repo.findById(id);
    if (!item) {
      throw notFoundError();
    }
    return item;
  }

  function assertValidFields(input: {
    title: string;
    kind: WatchKind;
    status: WatchStatus;
    url: string | null | undefined;
    rating: number | null | undefined;
    notes: string | null | undefined;
  }): void {
    const titleError = validateWatchTitle(input.title);
    if (titleError) {
      throw validationError(titleError);
    }
    const kindError = validateWatchKind(input.kind);
    if (kindError) {
      throw validationError(kindError);
    }
    const statusError = validateWatchStatus(input.status);
    if (statusError) {
      throw validationError(statusError);
    }
    const urlError = validateWatchUrl(input.url);
    if (urlError) {
      throw validationError(urlError);
    }
    const ratingError = validateWatchRating(input.rating);
    if (ratingError) {
      throw validationError(ratingError);
    }
    const notesError = validateWatchNotes(input.notes);
    if (notesError) {
      throw validationError(notesError);
    }
  }

  return {
    async list(filter: WatchFilter = {}): Promise<WatchItem[]> {
      try {
        return await repo.list(filter);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async getById(id: string): Promise<WatchItem> {
      try {
        return await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async create(input: CreateWatchItemInput): Promise<WatchItem> {
      const kind = input.kind ?? 'movie';
      const status = input.status ?? 'want_to_watch';
      assertValidFields({
        title: input.title,
        kind,
        status,
        url: input.url,
        rating: input.rating,
        notes: input.notes,
      });

      const timestamp = now();
      const item: WatchItem = {
        id: generateId(),
        title: input.title.trim(),
        kind,
        status,
        url: normalizeUrl(input.url),
        rating: input.rating ?? null,
        notes: normalizeNotes(input.notes),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await repo.insert(item);
      } catch (error) {
        throw databaseError(error);
      }
      return item;
    },

    async update(id: string, input: UpdateWatchItemInput): Promise<WatchItem> {
      let existing: WatchItem;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      const title = input.title === undefined ? existing.title : input.title;
      const kind = input.kind ?? existing.kind;
      const status = input.status ?? existing.status;
      const url = input.url === undefined ? existing.url : input.url;
      const rating = input.rating === undefined ? existing.rating : input.rating;
      const notes = input.notes === undefined ? existing.notes : input.notes;
      assertValidFields({ title, kind, status, url, rating, notes });

      const updated: WatchItem = {
        ...existing,
        title: title.trim(),
        kind,
        status,
        url: normalizeUrl(url),
        rating,
        notes: normalizeNotes(notes),
        updatedAt: now(),
      };

      try {
        await repo.update(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async setStatus(id: string, status: WatchStatus): Promise<WatchItem> {
      const statusError = validateWatchStatus(status);
      if (statusError) {
        throw validationError(statusError);
      }
      let existing: WatchItem;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }
      if (existing.status === status) {
        return existing;
      }
      return this.update(id, { status });
    },

    async setRating(id: string, rating: number | null): Promise<WatchItem> {
      const ratingError = validateWatchRating(rating);
      if (ratingError) {
        throw validationError(ratingError);
      }
      return this.update(id, { rating });
    },

    async remove(id: string): Promise<void> {
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

    async saveSpotlight(
      title: string,
      kind: WatchKind,
    ): Promise<{ item: WatchItem; created: boolean }> {
      const kindError = validateWatchKind(kind);
      if (kindError) {
        throw validationError(kindError);
      }
      const titleError = validateWatchTitle(title);
      if (titleError) {
        throw validationError(titleError);
      }
      try {
        const existing = await repo.findByTitle(title, kind);
        if (existing) {
          return { item: existing, created: false };
        }
      } catch (error) {
        throw databaseError(error);
      }
      const item = await this.create({ title, kind });
      return { item, created: true };
    },
  };
}
