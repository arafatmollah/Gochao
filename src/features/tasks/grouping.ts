import type { Task } from '@/types/task';

/** Stable section identifiers; screens translate them to localized titles. */
export type TaskSectionKey =
  | 'overdue'
  | 'today'
  | 'upcoming'
  | 'no-date'
  | 'recent-completed'
  | 'completed';

export interface TaskSection {
  key: TaskSectionKey;
  tone?: 'danger';
  data: Task[];
}

/**
 * Groups pending tasks (already ordered by the repository: due date first,
 * then priority) into the sections shown on the task list. Order within a
 * section is preserved.
 */
export function buildActiveSections(
  pending: Task[],
  recentCompleted: Task[],
  today: string,
): TaskSection[] {
  const overdue: Task[] = [];
  const dueToday: Task[] = [];
  const upcoming: Task[] = [];
  const noDueDate: Task[] = [];

  for (const task of pending) {
    if (!task.dueAt) {
      noDueDate.push(task);
    } else if (task.dueAt < today) {
      overdue.push(task);
    } else if (task.dueAt === today) {
      dueToday.push(task);
    } else {
      upcoming.push(task);
    }
  }

  const sections: TaskSection[] = [];
  if (overdue.length > 0) sections.push({ key: 'overdue', tone: 'danger', data: overdue });
  if (dueToday.length > 0) sections.push({ key: 'today', data: dueToday });
  if (upcoming.length > 0) sections.push({ key: 'upcoming', data: upcoming });
  if (noDueDate.length > 0) sections.push({ key: 'no-date', data: noDueDate });
  if (recentCompleted.length > 0) {
    sections.push({ key: 'recent-completed', data: recentCompleted });
  }
  return sections;
}

export function buildCompletedSection(completed: Task[]): TaskSection[] {
  if (completed.length === 0) {
    return [];
  }
  return [{ key: 'completed', data: completed }];
}
