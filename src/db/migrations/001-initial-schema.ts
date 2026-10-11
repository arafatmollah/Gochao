import type { Migration } from './types';

/**
 * 001 — Foundation schema: app settings and tasks.
 *
 * Date conventions:
 * - `due_at` is a calendar date (`YYYY-MM-DD`), not an instant, so "due
 *   Friday" stays the same day regardless of time zone.
 * - `created_at`, `updated_at`, `completed_at` are ISO-8601 UTC timestamps.
 *
 * The CHECK constraint on `completed_at` keeps the completion invariant in
 * the database itself: a task is completed exactly when it has a
 * completion timestamp.
 */
export const migration001: Migration = {
  version: 1,
  name: 'initial-schema',
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        description TEXT,
        due_at TEXT CHECK (
          due_at IS NULL OR
          due_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        priority TEXT NOT NULL DEFAULT 'medium'
          CHECK (priority IN ('low', 'medium', 'high')),
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'completed')),
        parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        CHECK (
          (status = 'completed' AND completed_at IS NOT NULL) OR
          (status = 'pending' AND completed_at IS NULL)
        )
      );

      CREATE INDEX idx_tasks_status_due_at ON tasks (status, due_at);
      CREATE INDEX idx_tasks_parent_task_id ON tasks (parent_task_id);
    `);
  },
};
