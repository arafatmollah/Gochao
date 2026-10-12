import type { Migration } from './types';

/**
 * 011 — Prayer reminder preference (master prompt Module J, first slice).
 *
 * A single `reminders_enabled` flag on the singleton settings row records
 * whether the user wants a notification at each prayer time. The flag is
 * data; the actual OS schedules are created/cancelled by the app at toggle
 * time and whenever the calculation settings change (see
 * `services/prayer-reminders.ts`). Only five daily-repeating schedules ever
 * exist — one per prayer — so scheduling stays bounded by construction.
 */
export const migration011: Migration = {
  version: 11,
  name: 'prayer-reminders',
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE prayer_settings ADD COLUMN reminders_enabled INTEGER
        NOT NULL DEFAULT 0 CHECK (reminders_enabled IN (0, 1));
    `);
  },
};
