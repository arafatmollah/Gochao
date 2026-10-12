import type { HealthRecordRepository } from '@/db/repositories/health-repository';
import type {
  CreateHealthRecordInput,
  HealthRecord,
  UpdateHealthRecordInput,
} from '@/types/health';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';
import { todayIsoDate } from '@/utils/dates';

import type { HealthValidationCode } from './health-validation';
import {
  validateHealthRecordContent,
  validateHealthRecordDate,
  validateHealthRecordTitle,
} from './health-validation';

export interface HealthRecordServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface HealthRecordService {
  list(limit?: number, offset?: number): Promise<HealthRecord[]>;
  getById(id: string): Promise<HealthRecord>;
  create(input: CreateHealthRecordInput): Promise<HealthRecord>;
  update(id: string, input: UpdateHealthRecordInput): Promise<HealthRecord>;
  remove(id: string): Promise<void>;
}

/** Wraps unexpected storage failures; never leaks SQL or record contents. */
function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This health note no longer exists.');
}

function validationError(code: HealthValidationCode): AppError {
  return new AppError('validation', code);
}

function normalizeContent(content: string | null | undefined): string | null {
  const trimmed = content?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function createHealthRecordService(
  repo: HealthRecordRepository,
  deps: HealthRecordServiceDeps = {},
): HealthRecordService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<HealthRecord> {
    const record = await repo.findById(id);
    if (!record) {
      throw notFoundError();
    }
    return record;
  }

  return {
    async list(limit?: number, offset?: number): Promise<HealthRecord[]> {
      try {
        return await repo.list(limit, offset);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async getById(id: string): Promise<HealthRecord> {
      try {
        return await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async create(input: CreateHealthRecordInput): Promise<HealthRecord> {
      const titleError = validateHealthRecordTitle(input.title);
      if (titleError) {
        throw validationError(titleError);
      }
      const contentError = validateHealthRecordContent(input.content);
      if (contentError) {
        throw validationError(contentError);
      }
      const recordedOn = input.recordedOn ?? todayIsoDate();
      const dateError = validateHealthRecordDate(recordedOn);
      if (dateError) {
        throw validationError(dateError);
      }

      const timestamp = now();
      const record: HealthRecord = {
        id: generateId(),
        title: input.title.trim(),
        content: normalizeContent(input.content),
        recordedOn,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await repo.insert(record);
      } catch (error) {
        throw databaseError(error);
      }
      return record;
    },

    async update(id: string, input: UpdateHealthRecordInput): Promise<HealthRecord> {
      let existing: HealthRecord;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      const title = input.title === undefined ? existing.title : input.title;
      const content = input.content === undefined ? existing.content : input.content;
      const recordedOn = input.recordedOn === undefined ? existing.recordedOn : input.recordedOn;

      const titleError = validateHealthRecordTitle(title);
      if (titleError) {
        throw validationError(titleError);
      }
      const contentError = validateHealthRecordContent(content);
      if (contentError) {
        throw validationError(contentError);
      }
      const dateError = validateHealthRecordDate(recordedOn);
      if (dateError) {
        throw validationError(dateError);
      }

      const updated: HealthRecord = {
        ...existing,
        title: title.trim(),
        content: normalizeContent(content),
        recordedOn,
        updatedAt: now(),
      };

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
