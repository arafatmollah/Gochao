import type { Migration } from './types';

/**
 * 006 — Family members and family requests (master prompt Module F / Phase 7).
 *
 * Model decisions:
 *
 * - Members and requests live only on this device; nothing here communicates
 *   with other devices (master prompt Module F). Members use an explicit
 *   `is_archived` flag instead of deletion-first: a member can leave the
 *   household view without losing the history of their requests.
 * - A request's status uses stable internal codes ('open', 'in_progress',
 *   'done', 'cancelled') — never translated labels (rule §9). The composite
 *   index (status, deadline) serves the outstanding-requests listing and the
 *   dashboard's open-request preview required by the master prompt.
 * - Requests reference their member with ON DELETE SET NULL, but the member
 *   repository additionally refuses to delete a member who still has
 *   requests (guarded DELETE), so links are only dropped deliberately.
 * - "Generate a task from a request without duplicating it" is structural:
 *   tasks gain a `family_request_id` link column with a UNIQUE index, so at
 *   most one task can ever point at a given request. Deleting a request
 *   keeps the generated task (rule 9) — the link is set to NULL.
 */
export const migration006: Migration = {
  version: 6,
  name: 'family',
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE family_members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        relationship TEXT NOT NULL CHECK (
          relationship IN ('self', 'spouse', 'father', 'mother', 'son',
                           'daughter', 'sibling', 'other')
        ),
        contact TEXT,
        notes TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_family_members_archived_name
        ON family_members (is_archived, name);

      CREATE TABLE family_requests (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        details TEXT,
        member_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
        category TEXT NOT NULL CHECK (
          category IN ('medicine', 'appointment', 'grocery', 'bill',
                       'household', 'other')
        ),
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (
          priority IN ('low', 'medium', 'high')
        ),
        deadline TEXT CHECK (
          deadline IS NULL
          OR deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        estimated_cost_minor INTEGER CHECK (
          estimated_cost_minor IS NULL OR estimated_cost_minor > 0
        ),
        status TEXT NOT NULL DEFAULT 'open' CHECK (
          status IN ('open', 'in_progress', 'done', 'cancelled')
        ),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_family_requests_status_deadline
        ON family_requests (status, deadline);
      CREATE INDEX idx_family_requests_member ON family_requests (member_id);

      ALTER TABLE tasks ADD COLUMN family_request_id TEXT
        REFERENCES family_requests(id) ON DELETE SET NULL;

      CREATE UNIQUE INDEX idx_tasks_family_request
        ON tasks (family_request_id);
    `);
  },
};
