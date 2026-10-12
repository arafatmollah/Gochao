export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ['pending', 'completed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_TITLE_MAX_LENGTH = 140;
export const TASK_DESCRIPTION_MAX_LENGTH = 2000;

export interface Task {
  id: string;
  title: string;
  description: string | null;
  /** Calendar due date `YYYY-MM-DD`, or null when no due date is set. */
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
  /** ISO-8601 UTC timestamp, set exactly when status is `completed`. */
  completedAt: string | null;
  /**
   * Links a task to the task it was generated from (recurrence lineage,
   * future subtasks). Null for top-level tasks.
   */
  parentTaskId: string | null;
  /**
   * Family request this task was generated from, if any. At most one task
   * can reference a given request (UNIQUE index), and deleting the request
   * keeps the task with this link cleared.
   */
  familyRequestId: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  dueAt?: string | null;
  priority?: TaskPriority;
  parentTaskId?: string | null;
  familyRequestId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  priority?: TaskPriority;
}

export interface TaskFilter {
  status?: TaskStatus;
  priority?: TaskPriority;
  /** Case-insensitive substring match on title and description. */
  search?: string;
  /** Only tasks with a due date on or before this `YYYY-MM-DD` date. */
  dueOnOrBefore?: string;
  /** Only tasks with a due date strictly before this `YYYY-MM-DD` date. */
  dueBefore?: string;
  limit?: number;
  offset?: number;
}
