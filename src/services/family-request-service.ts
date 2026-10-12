import type { FamilyMemberRepository } from '@/db/repositories/family-member-repository';
import type { FamilyRequestRepository } from '@/db/repositories/family-request-repository';
import type { TaskService } from '@/services/task-service';
import type {
  CreateFamilyRequestInput,
  FamilyRequest,
  FamilyRequestFilter,
  FamilyRequestListItem,
  FamilyRequestStatus,
  UpdateFamilyRequestInput,
} from '@/types/family';
import type { Task } from '@/types/task';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import {
  asRequestPriority,
  validateRequestCategory,
  validateRequestCost,
  validateRequestDeadline,
  validateRequestDetails,
  validateRequestPriority,
  validateRequestStatus,
  validateRequestTitle,
} from './family-validation';

export interface FamilyRequestServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface FamilyRequestService {
  list(filter?: FamilyRequestFilter): Promise<FamilyRequestListItem[]>;
  count(filter?: FamilyRequestFilter): Promise<number>;
  /** Requests awaiting action (`open` or `in_progress`) — dashboard figure. */
  countOutstanding(): Promise<number>;
  /** Outstanding requests, nearest deadline first — dashboard preview. */
  listOutstanding(limit: number): Promise<FamilyRequestListItem[]>;
  getById(id: string): Promise<FamilyRequest>;
  /** Id of the task generated from this request, if any. */
  getTaskLink(id: string): Promise<string | null>;
  create(input: CreateFamilyRequestInput): Promise<FamilyRequest>;
  /** Updates fields; status changes go through `setStatus`. */
  update(id: string, input: UpdateFamilyRequestInput): Promise<FamilyRequest>;
  /** Moves a request between `open` / `in_progress` / `done` / `cancelled`. Idempotent. */
  setStatus(id: string, status: FamilyRequestStatus): Promise<FamilyRequest>;
  /**
   * Creates a task from a request without duplicating it: the task carries
   * the request's title, details, deadline, and priority, and is linked via
   * `familyRequestId` (UNIQUE — one task per request, ever).
   */
  generateTask(id: string): Promise<Task>;
  remove(id: string): Promise<void>;
}

/** Wraps unexpected storage failures; never leaks SQL or record contents. */
function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This family request no longer exists.');
}

function assertValidTitle(title: string): string {
  const error = validateRequestTitle(title);
  if (error) {
    throw new AppError('validation', error);
  }
  return title.trim();
}

function normalizeDescription(description: string | null | undefined): string | null {
  const trimmed = description?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function assertValidation<T>(value: T, check: (value: T) => string | null): T {
  const error = check(value);
  if (error) {
    throw new AppError('validation', error);
  }
  return value;
}

export function createFamilyRequestService(
  repo: FamilyRequestRepository,
  deps: {
    members: Pick<FamilyMemberRepository, 'findById'>;
    tasks: Pick<TaskService, 'create'>;
  } & FamilyRequestServiceDeps,
): FamilyRequestService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;
  const members = deps.members;
  const tasks = deps.tasks;

  async function loadExisting(id: string): Promise<FamilyRequest> {
    const request = await repo.findById(id);
    if (!request) {
      throw notFoundError();
    }
    return request;
  }

  /** Throws when a non-null member id does not match a stored member. */
  async function assertMemberExists(memberId: string | null): Promise<void> {
    if (memberId === null) {
      return;
    }
    const member = await members.findById(memberId);
    if (!member) {
      throw new AppError('validation', 'family_request_member_invalid');
    }
  }

  return {
    async list(filter: FamilyRequestFilter = {}): Promise<FamilyRequestListItem[]> {
      try {
        return await repo.list(filter);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async count(filter: FamilyRequestFilter = {}): Promise<number> {
      try {
        return await repo.count(filter);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async countOutstanding(): Promise<number> {
      try {
        return await repo.countOutstanding();
      } catch (error) {
        throw databaseError(error);
      }
    },

    async listOutstanding(limit: number): Promise<FamilyRequestListItem[]> {
      try {
        return await repo.listOutstanding(limit);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async getById(id: string): Promise<FamilyRequest> {
      try {
        return await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async getTaskLink(id: string): Promise<string | null> {
      try {
        return await repo.findTaskLink(id);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async create(input: CreateFamilyRequestInput): Promise<FamilyRequest> {
      const title = assertValidTitle(input.title);

      const details = normalizeDescription(input.details);
      const detailsError = validateRequestDetails(details);
      if (detailsError) {
        throw new AppError('validation', detailsError);
      }

      const memberId = input.memberId ?? null;
      try {
        await assertMemberExists(memberId);
      } catch (error) {
        if (error instanceof AppError && error.code === 'validation') {
          throw error;
        }
        throw databaseError(error);
      }

      const category = input.category ?? 'other';
      const categoryError = validateRequestCategory(category);
      if (categoryError) {
        throw new AppError('validation', categoryError);
      }

      const priority = asRequestPriority(input.priority ?? 'medium');
      const priorityError = validateRequestPriority(priority);
      if (priorityError) {
        throw new AppError('validation', priorityError);
      }

      const deadline = input.deadline ?? null;
      const deadlineError = validateRequestDeadline(deadline);
      if (deadlineError) {
        throw new AppError('validation', deadlineError);
      }

      const estimatedCostMinor = input.estimatedCostMinor ?? null;
      const costError = validateRequestCost(estimatedCostMinor);
      if (costError) {
        throw new AppError('validation', costError);
      }

      const timestamp = now();
      const request: FamilyRequest = {
        id: generateId(),
        title,
        details,
        memberId,
        category,
        priority,
        deadline,
        estimatedCostMinor,
        status: 'open',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await repo.insert(request);
      } catch (error) {
        throw databaseError(error);
      }
      return request;
    },

    async update(id: string, input: UpdateFamilyRequestInput): Promise<FamilyRequest> {
      let existing: FamilyRequest;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      const title = input.title === undefined ? existing.title : assertValidTitle(input.title);

      const details =
        input.details === undefined ? existing.details : normalizeDescription(input.details);
      const detailsError = validateRequestDetails(details);
      if (detailsError) {
        throw new AppError('validation', detailsError);
      }

      const memberId = input.memberId === undefined ? existing.memberId : input.memberId;
      try {
        await assertMemberExists(memberId);
      } catch (error) {
        if (error instanceof AppError && error.code === 'validation') {
          throw error;
        }
        throw databaseError(error);
      }

      const category = input.category === undefined ? existing.category : input.category;
      const categoryError = validateRequestCategory(category);
      if (categoryError) {
        throw new AppError('validation', categoryError);
      }

      const priority = input.priority === undefined ? existing.priority : input.priority;
      const priorityError = validateRequestPriority(priority);
      if (priorityError) {
        throw new AppError('validation', priorityError);
      }

      const deadline = input.deadline === undefined ? existing.deadline : input.deadline;
      const deadlineError = validateRequestDeadline(deadline);
      if (deadlineError) {
        throw new AppError('validation', deadlineError);
      }

      const estimatedCostMinor =
        input.estimatedCostMinor === undefined
          ? existing.estimatedCostMinor
          : input.estimatedCostMinor;
      const costError = validateRequestCost(estimatedCostMinor);
      if (costError) {
        throw new AppError('validation', costError);
      }

      const updated: FamilyRequest = {
        ...existing,
        title,
        details,
        memberId,
        category,
        priority,
        deadline,
        estimatedCostMinor,
        updatedAt: now(),
      };

      try {
        await repo.update(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async setStatus(id: string, status: FamilyRequestStatus): Promise<FamilyRequest> {
      assertValidation(status, validateRequestStatus);

      let existing: FamilyRequest;
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

      const updated: FamilyRequest = { ...existing, status, updatedAt: now() };
      try {
        await repo.update(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async generateTask(id: string): Promise<Task> {
      let existing: FamilyRequest;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      let linkedTaskId: string | null;
      try {
        linkedTaskId = await repo.findTaskLink(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (linkedTaskId) {
        throw new AppError('conflict', 'family_request_task_exists');
      }

      return tasks.create({
        title: existing.title,
        description: existing.details,
        dueAt: existing.deadline,
        priority: existing.priority,
        familyRequestId: existing.id,
      });
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
