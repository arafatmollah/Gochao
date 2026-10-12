import type {
  PrayerCalculationMethod,
  PrayerCacheFingerprint,
  PrayerLog,
  PrayerMadhab,
  PrayerName,
  PrayerSettings,
  PrayerStatus,
  PrayerTime,
} from '@/types/prayer';
import {
  DEFAULT_PRAYER_CITY,
  DEFAULT_PRAYER_LATITUDE,
  DEFAULT_PRAYER_LONGITUDE,
  DEFAULT_PRAYER_MADHAB,
  DEFAULT_PRAYER_METHOD,
  DEFAULT_PRAYER_UTC_OFFSET_MINUTES,
} from '@/types/prayer';

import type { SqlDatabase } from '../sql';

interface PrayerSettingsRow {
  calculation_method: PrayerCalculationMethod;
  madhab: PrayerMadhab;
  latitude: number;
  longitude: number;
  city_label: string;
  fajr_adjust: number;
  dhuhr_adjust: number;
  asr_adjust: number;
  maghrib_adjust: number;
  isha_adjust: number;
  utc_offset_minutes: number | null;
  reminders_enabled: number | null;
  updated_at: string;
}

interface PrayerTimeRow {
  prayer: PrayerName;
  time: string;
  calc_method: string;
  madhab: string;
  latitude: number;
  longitude: number;
}

interface PrayerLogRow {
  date: string;
  prayer: PrayerName;
  status: PrayerStatus;
  logged_at: string;
  updated_at: string;
}

function mapSettingsRow(row: PrayerSettingsRow): PrayerSettings {
  return {
    calculationMethod: row.calculation_method,
    madhab: row.madhab,
    latitude: row.latitude,
    longitude: row.longitude,
    cityLabel: row.city_label,
    adjustments: {
      fajr: row.fajr_adjust,
      dhuhr: row.dhuhr_adjust,
      asr: row.asr_adjust,
      maghrib: row.maghrib_adjust,
      isha: row.isha_adjust,
    },
    // Rows written before migrations 011/012 lack the newer columns.
    remindersEnabled: row.reminders_enabled === 1,
    utcOffsetMinutes: row.utc_offset_minutes ?? DEFAULT_PRAYER_UTC_OFFSET_MINUTES,
    updatedAt: row.updated_at,
  };
}

function mapLogRow(row: PrayerLogRow): PrayerLog {
  return {
    date: row.date,
    prayer: row.prayer,
    status: row.status,
    loggedAt: row.logged_at,
    updatedAt: row.updated_at,
  };
}

export interface PrayerRepository {
  /** The saved settings row, or null before the user ever saves. */
  findSettings(): Promise<PrayerSettings | null>;
  /** Inserts or replaces the singleton settings row. */
  upsertSettings(settings: PrayerSettings): Promise<void>;
  /** Cached times for a day (possibly empty), oldest prayer first. */
  listDayTimes(date: string): Promise<(PrayerTime & PrayerCacheFingerprint)[]>;
  /** Atomically replaces a day's cached times. */
  replaceDayTimes(
    date: string,
    times: PrayerTime[],
    fingerprint: PrayerCacheFingerprint,
    createdAt: string,
  ): Promise<void>;
  /** Drops cached days strictly older than `beforeDate` (`YYYY-MM-DD`). */
  deleteTimesBefore(beforeDate: string): Promise<void>;
  /** Logs with `startDate <= date <= endDate`, ordered by date then prayer. */
  listLogs(startDate: string, endDate: string): Promise<PrayerLog[]>;
  /** Inserts or replaces a prayer log. */
  upsertLog(log: PrayerLog): Promise<void>;
  deleteLog(date: string, prayer: PrayerName): Promise<boolean>;
}

const SETTINGS_COLUMNS = `
  calculation_method, madhab, latitude, longitude, city_label,
  fajr_adjust, dhuhr_adjust, asr_adjust, maghrib_adjust, isha_adjust,
  utc_offset_minutes, reminders_enabled, updated_at
`;

export class SqlitePrayerRepository implements PrayerRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findSettings(): Promise<PrayerSettings | null> {
    const row = await this.db.getFirstAsync<PrayerSettingsRow>(
      `SELECT ${SETTINGS_COLUMNS} FROM prayer_settings WHERE id = 'default'`,
    );
    return row ? mapSettingsRow(row) : null;
  }

  async upsertSettings(settings: PrayerSettings): Promise<void> {
    if (!settings.updatedAt) {
      throw new Error('Prayer settings require an updatedAt timestamp.');
    }
    await this.db.runAsync(
      `INSERT INTO prayer_settings (
         id, calculation_method, madhab, latitude, longitude, city_label,
         fajr_adjust, dhuhr_adjust, asr_adjust, maghrib_adjust, isha_adjust,
         utc_offset_minutes, reminders_enabled, updated_at
       ) VALUES (
         'default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       ) ON CONFLICT (id) DO UPDATE SET
         calculation_method = excluded.calculation_method,
         madhab = excluded.madhab,
         latitude = excluded.latitude,
         longitude = excluded.longitude,
         city_label = excluded.city_label,
         fajr_adjust = excluded.fajr_adjust,
         dhuhr_adjust = excluded.dhuhr_adjust,
         asr_adjust = excluded.asr_adjust,
         maghrib_adjust = excluded.maghrib_adjust,
         isha_adjust = excluded.isha_adjust,
         utc_offset_minutes = excluded.utc_offset_minutes,
         reminders_enabled = excluded.reminders_enabled,
         updated_at = excluded.updated_at`,
      [
        settings.calculationMethod,
        settings.madhab,
        settings.latitude,
        settings.longitude,
        settings.cityLabel,
        settings.adjustments.fajr,
        settings.adjustments.dhuhr,
        settings.adjustments.asr,
        settings.adjustments.maghrib,
        settings.adjustments.isha,
        settings.utcOffsetMinutes,
        settings.remindersEnabled ? 1 : 0,
        settings.updatedAt,
      ],
    );
  }

  async listDayTimes(date: string): Promise<(PrayerTime & PrayerCacheFingerprint)[]> {
    const rows = await this.db.getAllAsync<PrayerTimeRow>(
      `SELECT prayer, time, calc_method, madhab, latitude, longitude
         FROM prayer_day_times WHERE date = ?
        ORDER BY CASE prayer
          WHEN 'fajr' THEN 0 WHEN 'dhuhr' THEN 1 WHEN 'asr' THEN 2
          WHEN 'maghrib' THEN 3 ELSE 4 END ASC`,
      [date],
    );
    return rows.map((row) => ({
      prayer: row.prayer,
      time: row.time,
      calcMethod: row.calc_method,
      madhab: row.madhab,
      latitude: row.latitude,
      longitude: row.longitude,
    }));
  }

  async replaceDayTimes(
    date: string,
    times: PrayerTime[],
    fingerprint: PrayerCacheFingerprint,
    createdAt: string,
  ): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM prayer_day_times WHERE date = ?', [date]);
      for (const entry of times) {
        await tx.runAsync(
          `INSERT INTO prayer_day_times (
             date, prayer, time, calc_method, madhab, latitude, longitude, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            date,
            entry.prayer,
            entry.time,
            fingerprint.calcMethod,
            fingerprint.madhab,
            fingerprint.latitude,
            fingerprint.longitude,
            createdAt,
          ],
        );
      }
    });
  }

  async deleteTimesBefore(beforeDate: string): Promise<void> {
    await this.db.runAsync('DELETE FROM prayer_day_times WHERE date < ?', [beforeDate]);
  }

  async listLogs(startDate: string, endDate: string): Promise<PrayerLog[]> {
    const rows = await this.db.getAllAsync<PrayerLogRow>(
      `SELECT date, prayer, status, logged_at, updated_at FROM prayer_logs
        WHERE date >= ? AND date <= ?
        ORDER BY date ASC, CASE prayer
          WHEN 'fajr' THEN 0 WHEN 'dhuhr' THEN 1 WHEN 'asr' THEN 2
          WHEN 'maghrib' THEN 3 ELSE 4 END ASC`,
      [startDate, endDate],
    );
    return rows.map(mapLogRow);
  }

  async upsertLog(log: PrayerLog): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO prayer_logs (date, prayer, status, logged_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (date, prayer) DO UPDATE SET
         status = excluded.status,
         logged_at = excluded.logged_at,
         updated_at = excluded.updated_at`,
      [log.date, log.prayer, log.status, log.loggedAt, log.updatedAt],
    );
  }

  async deleteLog(date: string, prayer: PrayerName): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM prayer_logs WHERE date = ? AND prayer = ?', [
      date,
      prayer,
    ]);
    return result.changes > 0;
  }
}

/** Settings used before the user ever saves: Karachi, Hanafi, Dhaka. */
export function defaultPrayerSettings(): PrayerSettings {
  return {
    calculationMethod: DEFAULT_PRAYER_METHOD,
    madhab: DEFAULT_PRAYER_MADHAB,
    latitude: DEFAULT_PRAYER_LATITUDE,
    longitude: DEFAULT_PRAYER_LONGITUDE,
    cityLabel: DEFAULT_PRAYER_CITY,
    utcOffsetMinutes: DEFAULT_PRAYER_UTC_OFFSET_MINUTES,
    adjustments: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
    remindersEnabled: false,
    updatedAt: null,
  };
}
