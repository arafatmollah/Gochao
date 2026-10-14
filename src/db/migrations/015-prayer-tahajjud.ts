import type { Migration } from './types';

/**
 * 015 — Tahajjud prayer support.
 *
 * Widens the `prayer` CHECK on `prayer_day_times` and `prayer_logs` to admit
 * `tahajjud`. SQLite cannot ALTER a CHECK constraint, so each table is
 * rebuilt (copy, drop, rename); column order is preserved so plain
 * `SELECT *` copies are exact. Existing rows are untouched, and stale
 * five-row day caches are naturally recalculated (the service treats a day
 * as fresh only when it holds all six prayers).
 */
const PRAYER_CHECK = `prayer IN ('tahajjud', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha')`;

export const migration015: Migration = {
  version: 15,
  name: 'prayer-tahajjud',
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE prayer_day_times_new (
        date TEXT NOT NULL CHECK (
          date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        prayer TEXT NOT NULL CHECK (${PRAYER_CHECK}),
        time TEXT NOT NULL CHECK (
          time GLOB '[0-9][0-9]:[0-9][0-9]'
        ),
        calc_method TEXT NOT NULL,
        madhab TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (date, prayer)
      );
      INSERT INTO prayer_day_times_new SELECT * FROM prayer_day_times;
      DROP TABLE prayer_day_times;
      ALTER TABLE prayer_day_times_new RENAME TO prayer_day_times;
      CREATE INDEX idx_prayer_day_times_date ON prayer_day_times (date);

      CREATE TABLE prayer_logs_new (
        date TEXT NOT NULL CHECK (
          date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        prayer TEXT NOT NULL CHECK (${PRAYER_CHECK}),
        status TEXT NOT NULL CHECK (status IN ('prayed', 'missed')),
        logged_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (date, prayer)
      );
      INSERT INTO prayer_logs_new SELECT * FROM prayer_logs;
      DROP TABLE prayer_logs;
      ALTER TABLE prayer_logs_new RENAME TO prayer_logs;
      CREATE INDEX idx_prayer_logs_date ON prayer_logs (date);
    `);
  },
};
