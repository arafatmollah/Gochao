import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_PRIORITIES,
  TASK_TITLE_MAX_LENGTH,
  type TaskPriority,
} from '@/types/task';
import { isValidIsoDate } from '@/utils/dates';

/**
 * Shared task validation rules, used both by the form (field-level feedback)
 * and by the task service (authoritative check before persisting).
 *
 * Validators return a stable machine-readable code (or null when valid).
 * The UI translates codes into localized copy via `translateValidationCode`;
 * services wrap them in `AppError('validation', code)`.
 */

export type TaskValidationCode =
  | 'title_required'
  | 'title_too_long'
  | 'description_too_long'
  | 'due_invalid'
  | 'priority_invalid';

export function validateTaskTitle(title: string): TaskValidationCode | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return 'title_required';
  }
  if (trimmed.length > TASK_TITLE_MAX_LENGTH) {
    return 'title_too_long';
  }
  return null;
}

export function validateTaskDescription(
  description: string | null | undefined,
): TaskValidationCode | null {
  if (description && description.trim().length > TASK_DESCRIPTION_MAX_LENGTH) {
    return 'description_too_long';
  }
  return null;
}

export function validateTaskDueDate(
  dueAt: string | null | undefined,
): TaskValidationCode | null {
  if (dueAt == null || dueAt === '') {
    return null;
  }
  if (!isValidIsoDate(dueAt)) {
    return 'due_invalid';
  }
  return null;
}

export function validateTaskPriority(priority: string): TaskValidationCode | null {
  if (!(TASK_PRIORITIES as readonly string[]).includes(priority)) {
    return 'priority_invalid';
  }
  return null;
}

/** Normalizes a priority value coming from untrusted input. */
export function asTaskPriority(value: string): TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(value)
    ? (value as TaskPriority)
    : 'medium';
}
