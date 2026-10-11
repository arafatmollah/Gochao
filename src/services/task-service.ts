import type { TaskRepository } from '@/db/repositories/task-repository';
import type { CreateTaskInput, Task, TaskFilter, UpdateTaskInput } from '@/types/task';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import {
  asTaskPriority,
  validateTaskDescription,
  validateTaskDueDate,
  validateTaskPriority,
  validateTaskTitle,
} from './task-validation';

export interface TaskServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface TaskService {
  list(filter?: TaskFilter): Promise<Task[]>;
  count(filter?: TaskFilter): Promise<number>;
  /** Counts tasks completed within `[startIso, endIso)` (UTC instants). */
  countCompletedBetween(startIso: string, endIso: string): Promise<number>;
  getById(id: string): Promise<Task>;
  create(input: CreateTaskInput): Promise<Task>;
  update(id: string, input: UpdateTaskInput): Promise<Task>;
  /** Completes or reopens a task. Idempotent: repeating a transition is safe. */
  setCompleted(id: string, completed: boolean): Promise<Task>;
  remove(id: string): Promise<void>;
}

/** Wraps unexpected storage failures; never leaks SQL or record contents. */
function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This task no longer exists.');
}

function normalizeDescription(description: string | null | undefined): string | null {
  const trimmed = description?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function assertValidTitle(title: string): string {
  const error = validateTaskTitle(title);
  if (error) {
    throw new AppError('validation', error);
  }
  return title.trim();
}

export function createTaskService(repo: TaskRepository, deps: TaskServiceDeps = {}): TaskService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<Task> {
    const task = await repo.findById(id);
    if (!task) {
      throw notFoundError();
    }
    return task;
  }

  return {
    async list(filter: TaskFilter = {}): Promise<Task[]> {
      try {
        return await repo.list(filter);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async count(filter: TaskFilter = {}): Promise<number> {
      try {
        return await repo.count(filter);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async countCompletedBetween(startIso: string, endIso: string): Promise<number> {
      try {
        return await repo.countCompletedBetween(startIso, endIso);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async getById(id: string): Promise<Task> {
      try {
        return await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async create(input: CreateTaskInput): Promise<Task> {
      const title = assertValidTitle(input.title);

      const description = normalizeDescription(input.description);
      const descriptionError = validateTaskDescription(description);
      if (descriptionError) {
        throw new AppError('validation', descriptionError);
      }

      const dueAt = input.dueAt ?? null;
      const dueDateError = validateTaskDueDate(dueAt);
      if (dueDateError) {
        throw new AppError('validation', dueDateError);
      }

      const priority = asTaskPriority(input.priority ?? 'medium');
      const priorityError = validateTaskPriority(priority);
      if (priorityError) {
        throw new AppError('validation', priorityError);
      }

      const timestamp = now();
      const task: Task = {
        id: generateId(),
        title,
        description,
        dueAt,
        priority,
        status: 'pending',
        parentTaskId: input.parentTaskId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: null,
      };

      try {
        await repo.insert(task);
      } catch (error) {
        throw databaseError(error);
      }
      return task;
    },

    async update(id: string, input: UpdateTaskInput): Promise<Task> {
      let existing: Task;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      const title = input.title === undefined ? existing.title : assertValidTitle(input.title);

      const description =
        input.description === undefined
          ? existing.description
          : normalizeDescription(input.description);
      const descriptionError = validateTaskDescription(description);
      if (descriptionError) {
        throw new AppError('validation', descriptionError);
      }

      const dueAt = input.dueAt === undefined ? existing.dueAt : input.dueAt;
      const dueDateError = validateTaskDueDate(dueAt);
      if (dueDateError) {
        throw new AppError('validation', dueDateError);
      }

      const priority = input.priority === undefined ? existing.priority : input.priority;
      const priorityError = validateTaskPriority(priority);
      if (priorityError) {
        throw new AppError('validation', priorityError);
      }

      const updated: Task = {
        ...existing,
        title,
        description,
        dueAt,
        priority,
        updatedAt: now(),
      };

      try {
        await repo.update(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async setCompleted(id: string, completed: boolean): Promise<Task> {
      let existing: Task;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      if (completed && existing.status === 'completed') {
        return existing;
      }
      if (!completed && existing.status === 'pending') {
        return existing;
      }

      const timestamp = now();
      const updated: Task = completed
        ? { ...existing, status: 'completed', completedAt: timestamp, updatedAt: timestamp }
        : { ...existing, status: 'pending', completedAt: null, updatedAt: timestamp };

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
