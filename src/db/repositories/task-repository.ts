import type { Task, TaskFilter, TaskPriority, TaskStatus } from '@/types/task';

import { escapeLikePattern, type SqlDatabase, type SqlParam } from '../sql';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  parent_task_id: string | null;
  family_request_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function mapRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    priority: row.priority,
    status: row.status,
    parentTaskId: row.parent_task_id,
    familyRequestId: row.family_request_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export const DEFAULT_TASK_LIST_LIMIT = 200;

export interface TaskRepository {
  insert(task: Task): Promise<void>;
  update(task: Task): Promise<void>;
  findById(id: string): Promise<Task | null>;
  list(filter: TaskFilter): Promise<Task[]>;
  count(filter: TaskFilter): Promise<number>;
  /** Counts completed tasks with `completed_at` in `[startIso, endIso)`. */
  countCompletedBetween(startIso: string, endIso: string): Promise<number>;
  delete(id: string): Promise<boolean>;
}

function buildFilter(filter: TaskFilter): { where: string; params: SqlParam[] } {
  const conditions: string[] = [];
  const params: SqlParam[] = [];

  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  if (filter.priority) {
    conditions.push('priority = ?');
    params.push(filter.priority);
  }
  if (filter.search && filter.search.trim() !== '') {
    const pattern = `%${escapeLikePattern(filter.search.trim())}%`;
    conditions.push(
      `(title LIKE ? ESCAPE '\\' OR IFNULL(description, '') LIKE ? ESCAPE '\\')`,
    );
    params.push(pattern, pattern);
  }
  if (filter.dueOnOrBefore) {
    conditions.push('due_at IS NOT NULL AND due_at <= ?');
    params.push(filter.dueOnOrBefore);
  }
  if (filter.dueBefore) {
    conditions.push('due_at IS NOT NULL AND due_at < ?');
    params.push(filter.dueBefore);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

const SELECT_COLUMNS = `
  id, title, description, due_at, priority, status, parent_task_id,
  family_request_id, created_at, updated_at, completed_at
`;

const ORDER_PENDING = `
  ORDER BY (due_at IS NULL) ASC,
           due_at ASC,
           CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
           created_at DESC
`;

const ORDER_COMPLETED = `ORDER BY completed_at DESC, created_at DESC`;

const ORDER_ALL = `
  ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END ASC,
           CASE WHEN status = 'pending' THEN (due_at IS NULL) END ASC,
           CASE WHEN status = 'pending' THEN due_at END ASC,
           CASE WHEN status = 'pending'
                THEN (CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END)
           END ASC,
           CASE WHEN status = 'completed' THEN completed_at END DESC,
           created_at DESC
`;

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(task: Task): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO tasks (
         id, title, description, due_at, priority, status, parent_task_id,
         family_request_id, created_at, updated_at, completed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.dueAt,
        task.priority,
        task.status,
        task.parentTaskId,
        task.familyRequestId,
        task.createdAt,
        task.updatedAt,
        task.completedAt,
      ],
    );
  }

  async update(task: Task): Promise<void> {
    await this.db.runAsync(
      `UPDATE tasks
          SET title = ?, description = ?, due_at = ?, priority = ?, status = ?,
              parent_task_id = ?, family_request_id = ?, updated_at = ?, completed_at = ?
        WHERE id = ?`,
      [
        task.title,
        task.description,
        task.dueAt,
        task.priority,
        task.status,
        task.parentTaskId,
        task.familyRequestId,
        task.updatedAt,
        task.completedAt,
        task.id,
      ],
    );
  }

  async findById(id: string): Promise<Task | null> {
    const row = await this.db.getFirstAsync<TaskRow>(
      `SELECT ${SELECT_COLUMNS} FROM tasks WHERE id = ?`,
      [id],
    );
    return row ? mapRow(row) : null;
  }

  async list(filter: TaskFilter): Promise<Task[]> {
    const { where, params } = buildFilter(filter);
    const order =
      filter.status === 'pending'
        ? ORDER_PENDING
        : filter.status === 'completed'
          ? ORDER_COMPLETED
          : ORDER_ALL;

    const limit = filter.limit ?? DEFAULT_TASK_LIST_LIMIT;
    const offset = filter.offset ?? 0;

    const rows = await this.db.getAllAsync<TaskRow>(
      `SELECT ${SELECT_COLUMNS} FROM tasks ${where} ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map(mapRow);
  }

  async count(filter: TaskFilter): Promise<number> {
    const { where, params } = buildFilter(filter);
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM tasks ${where}`,
      params,
    );
    return row?.total ?? 0;
  }

  async countCompletedBetween(startIso: string, endIso: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM tasks
        WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?`,
      [startIso, endIso],
    );
    return row?.total ?? 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
    return result.changes > 0;
  }
}
