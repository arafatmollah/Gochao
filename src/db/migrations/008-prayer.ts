import type { Migration } from './types';

/**
 * 008 — Prayer configuration and logs (master prompt Module I / Phase 8).
 *
 * Model decisions:
 *
 * - `prayer_settings` holds at most one row (`id = 'default'`). Column
 *   DEFAULTs encode the Bangladesh-appropriate configuration (Karachi
 *   method, Hanafi madhab, Dhaka coordinates); the service falls back to the
 *   same defaults when no row has been saved yet, so a fresh install works
 *   with zero setup. Calculation itself is done offline by the `adhan`
 *   library — the database never stores where the numbers came from, only
 *   the user's configuration.
 * - `prayer_day_times` caches calculated schedules as local wall-clock
 *   `HH:mm` text plus a fingerprint (method, madhab, coordinates) of the
 *   settings that produced them. A cached day is reused only when the
 *   fingerprint still matches the current settings; otherwise the day is
 *   recalculated. Storing wall-clock text (not instants) keeps displayed
 *   times stable if the device timezone changes while traveling.
 * - `prayer_logs` records completion per (date, prayer) with a composite
 *   primary key: at most one log per prayer per day, updated in place via
 *   upsert. Unmarking a prayer deletes its log row — absence means "not
 *   recorded", never "missed".
 * - Reminders are intentionally out of scope here: scheduling notifications
 *   belongs to Module J (local notifications + a development build) and a
 *   stored toggle with no scheduling behind it would be dishonest UI.
 */
export const migration008: Migration = {
  version: 8,
  name: 'prayer',
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE prayer_settings (
        id TEXT PRIMARY KEY CHECK (id = 'default'),
        calculation_method TEXT NOT NULL DEFAULT 'karachi' CHECK (
          calculation_method IN ('karachi', 'muslimWorldLeague', 'egyptian',
                                 'ummAlQura', 'singapore', 'dubai')
        ),
        madhab TEXT NOT NULL DEFAULT 'hanafi' CHECK (madhab IN ('hanafi', 'shafi')),
        latitude REAL NOT NULL DEFAULT 23.8103 CHECK (latitude >= -90 AND latitude <= 90),
        longitude REAL NOT NULL DEFAULT 90.4125 CHECK (longitude >= -180 AND longitude <= 180),
        city_label TEXT NOT NULL DEFAULT 'Dhaka',
        fajr_adjust INTEGER NOT NULL DEFAULT 0 CHECK (fajr_adjust >= -60 AND fajr_adjust <= 60),
        dhuhr_adjust INTEGER NOT NULL DEFAULT 0 CHECK (dhuhr_adjust >= -60 AND dhuhr_adjust <= 60),
        asr_adjust INTEGER NOT NULL DEFAULT 0 CHECK (asr_adjust >= -60 AND asr_adjust <= 60),
        maghrib_adjust INTEGER NOT NULL DEFAULT 0 CHECK (maghrib_adjust >= -60 AND maghrib_adjust <= 60),
        isha_adjust INTEGER NOT NULL DEFAULT 0 CHECK (isha_adjust >= -60 AND isha_adjust <= 60),
        updated_at TEXT NOT NULL
      );

      CREATE TABLE prayer_day_times (
        date TEXT NOT NULL CHECK (
          date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        prayer TEXT NOT NULL CHECK (
          prayer IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')
        ),
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

      CREATE INDEX idx_prayer_day_times_date ON prayer_day_times (date);

      CREATE TABLE prayer_logs (
        date TEXT NOT NULL CHECK (
          date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        prayer TEXT NOT NULL CHECK (
          prayer IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')
        ),
        status TEXT NOT NULL CHECK (status IN ('prayed', 'missed')),
        logged_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (date, prayer)
      );

      CREATE INDEX idx_prayer_logs_date ON prayer_logs (date);
    `);
  },
};
