import type { Migration } from './types';

/**
 * 012 — Prayer UTC offset ("Timezone" configuration, Module I).
 *
 * The adhan library reads the input day in device-local components but
 * returns instants anchored to UTC midnight, so formatting those instants
 * with device-local getters is only correct when the device sits in the
 * prayer location's timezone. This column stores the location's offset from
 * UTC in whole minutes (Dhaka is +360) and all displayed times are derived
 * from instant + offset — exact on any device, in any timezone, offline.
 */
export const migration012: Migration = {
  version: 12,
  name: 'prayer-utc-offset',
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE prayer_settings ADD COLUMN utc_offset_minutes INTEGER
        NOT NULL DEFAULT 360 CHECK (utc_offset_minutes >= -720 AND utc_offset_minutes <= 840);
    `);
  },
};
