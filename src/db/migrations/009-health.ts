import type { Migration } from './types';

/**
 * 009 — Medicine and health records (master prompt Module H / Phase 8).
 *
 * Scope: personal recordkeeping only — the module stores what the user was
 * told and what they did, and never diagnoses, infers dosages, or changes
 * instructions. Reminders are intentionally out of scope: scheduling
 * notifications belongs to Module J, and a stored toggle with no scheduling
 * behind it would be dishonest UI.
 *
 * Model decisions:
 *
 * - `medicines` carry free-text strength and dosage instructions exactly as
 *   entered (never inferred from the name). `frequency` is a coarse bucket
 *   (`daily`, `weekly`, `as_needed`); the actual checklist comes from
 *   `medicine_schedules` rows, each a wall-clock `HH:mm` time plus an
 *   optional weekday set (`1`–`7`, Monday-first, CSV). `as_needed`
 *   medicines hold no schedules and therefore never appear on the daily
 *   checklist.
 * - `medicine_logs` record one status per (schedule, date) with a composite
 *   primary key: at most one log per dose, updated in place via upsert.
 *   Absence means "not recorded" — never "missed" and never "taken", so a
 *   reminder can never masquerade as a confirmation. Schedule deletion
 *   cascades to its logs; editing a medicine keeps untouched schedule rows
 *   (matched by id) so their history survives.
 * - `appointments` and `health_records` are simple dated records with no
 *   status machinery: upcoming means `date >= today`, history means older.
 *   Deleting them is allowed — they are notes, not financial or medical
 *   history the app must preserve.
 */
export const migration009: Migration = {
  version: 9,
  name: 'health',
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE medicines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        strength TEXT,
        dosage TEXT,
        frequency TEXT NOT NULL DEFAULT 'daily' CHECK (
          frequency IN ('daily', 'weekly', 'as_needed')
        ),
        start_date TEXT CHECK (
          start_date IS NULL OR
          start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        end_date TEXT CHECK (
          end_date IS NULL OR
          end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        prescriber TEXT,
        notes TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          start_date IS NULL OR end_date IS NULL OR end_date >= start_date
        )
      );

      CREATE INDEX idx_medicines_archived_name
        ON medicines (is_archived, name);

      CREATE TABLE medicine_schedules (
        id TEXT PRIMARY KEY,
        medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
        time TEXT NOT NULL CHECK (
          time GLOB '[0-9][0-9]:[0-9][0-9]'
        ),
        weekdays TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX idx_medicine_schedules_medicine
        ON medicine_schedules (medicine_id);

      CREATE TABLE medicine_logs (
        schedule_id TEXT NOT NULL REFERENCES medicine_schedules(id) ON DELETE CASCADE,
        date TEXT NOT NULL CHECK (
          date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        status TEXT NOT NULL CHECK (status IN ('taken', 'skipped')),
        logged_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (schedule_id, date)
      );

      CREATE INDEX idx_medicine_logs_date ON medicine_logs (date);

      CREATE TABLE appointments (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        doctor TEXT,
        place TEXT,
        date TEXT NOT NULL CHECK (
          date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        time TEXT CHECK (
          time IS NULL OR time GLOB '[0-9][0-9]:[0-9][0-9]'
        ),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_appointments_date ON appointments (date);

      CREATE TABLE health_records (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        content TEXT,
        recorded_on TEXT NOT NULL CHECK (
          recorded_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_health_records_recorded_on
        ON health_records (recorded_on DESC);
    `);
  },
};
