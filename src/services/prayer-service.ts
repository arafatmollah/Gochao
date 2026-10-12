import { defaultPrayerSettings, type PrayerRepository } from '@/db/repositories/prayer-repository';
import type {
  PrayerCacheFingerprint,
  PrayerDay,
  PrayerLog,
  PrayerName,
  PrayerSettings,
  PrayerStatus,
  UpdatePrayerSettingsInput,
} from '@/types/prayer';
import { PRAYERS } from '@/types/prayer';
import { addDaysIsoDate } from '@/utils/dates';
import { AppError } from '@/utils/errors';
import { nowIso } from '@/utils/time';

import type { PrayerValidationCode } from './prayer-validation';
import { calculateDayTimes } from './prayer-calculation';
import {
  validatePrayerAdjust,
  validatePrayerCity,
  validatePrayerDate,
  validatePrayerLatitude,
  validatePrayerLongitude,
  validatePrayerMadhab,
  validatePrayerMethod,
  validatePrayerName,
  validatePrayerStatus,
  validateUtcOffsetMinutes,
} from './prayer-validation';

export interface PrayerServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
}

export interface PrayerService {
  /** Saved settings, or Dhaka defaults before the first save. */
  getSettings(): Promise<PrayerSettings>;
  updateSettings(input: UpdatePrayerSettingsInput): Promise<PrayerSettings>;
  /** Today's (or any day's) times with recorded statuses, from cache when fresh. */
  getDay(date: string): Promise<PrayerDay>;
  /** History for `endDate` and the `dayCount - 1` days before it. */
  getHistory(endDate: string, dayCount: number): Promise<PrayerDay[]>;
  logPrayer(date: string, prayer: PrayerName, status: PrayerStatus): Promise<PrayerLog>;
  /** Removes a log; absence afterwards means "not recorded". No-op when missing. */
  clearLog(date: string, prayer: PrayerName): Promise<boolean>;
}

/** Wraps unexpected storage failures; never leaks SQL or record contents. */
function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function validationError(code: PrayerValidationCode): AppError {
  return new AppError('validation', code);
}

/** Cached rows are reused only when produced by these exact settings. */
function fingerprintOf(settings: PrayerSettings): PrayerCacheFingerprint {
  return {
    calcMethod: settings.calculationMethod,
    madhab: settings.madhab,
    latitude: settings.latitude,
    longitude: settings.longitude,
  };
}

function fingerprintMatches(
  cached: PrayerCacheFingerprint,
  current: PrayerCacheFingerprint,
): boolean {
  return (
    cached.calcMethod === current.calcMethod &&
    cached.madhab === current.madhab &&
    cached.latitude === current.latitude &&
    cached.longitude === current.longitude
  );
}

export function createPrayerService(
  repo: PrayerRepository,
  deps: PrayerServiceDeps = {},
): PrayerService {
  const now = deps.now ?? nowIso;

  async function loadSettings(): Promise<PrayerSettings> {
    try {
      return (await repo.findSettings()) ?? defaultPrayerSettings();
    } catch (error) {
      throw databaseError(error);
    }
  }

  /** Times for one day, recalculating and caching when the cache is stale. */
  async function resolveDayTimes(
    date: string,
    settings: PrayerSettings,
  ): Promise<{ date: string; prayers: { prayer: PrayerName; time: string; status: PrayerStatus | null }[] }> {
    const fingerprint = fingerprintOf(settings);
    let cached: Awaited<ReturnType<PrayerRepository['listDayTimes']>>;
    let logs: PrayerLog[];
    try {
      [cached, logs] = await Promise.all([
        repo.listDayTimes(date),
        repo.listLogs(date, date),
      ]);
    } catch (error) {
      throw databaseError(error);
    }

    const fresh =
      cached.length === PRAYERS.length &&
      cached.every((row) => fingerprintMatches(row, fingerprint));

    let times = cached.map(({ prayer, time }) => ({ prayer, time }));
    if (!fresh) {
      let calculated: { prayer: PrayerName; time: string }[];
      try {
        calculated = calculateDayTimes(date, settings);
      } catch (error) {
        throw databaseError(error);
      }
      const timestamp = now();
      try {
        await repo.replaceDayTimes(date, calculated, fingerprint, timestamp);
      } catch (error) {
        throw databaseError(error);
      }
      times = calculated;
    }

    const statusByPrayer = new Map(logs.map((log) => [log.prayer, log.status]));
    return {
      date,
      prayers: times.map((entry) => ({
        ...entry,
        status: statusByPrayer.get(entry.prayer) ?? null,
      })),
    };
  }

  return {
    async getSettings(): Promise<PrayerSettings> {
      return loadSettings();
    },

    async updateSettings(input: UpdatePrayerSettingsInput): Promise<PrayerSettings> {
      const current = await loadSettings();

      const calculationMethod = input.calculationMethod ?? current.calculationMethod;
      const methodError = validatePrayerMethod(calculationMethod);
      if (methodError) {
        throw validationError(methodError);
      }

      const madhab = input.madhab ?? current.madhab;
      const madhabError = validatePrayerMadhab(madhab);
      if (madhabError) {
        throw validationError(madhabError);
      }

      const latitude = input.latitude ?? current.latitude;
      const latitudeError = validatePrayerLatitude(latitude);
      if (latitudeError) {
        throw validationError(latitudeError);
      }

      const longitude = input.longitude ?? current.longitude;
      const longitudeError = validatePrayerLongitude(longitude);
      if (longitudeError) {
        throw validationError(longitudeError);
      }

      const cityLabel = (input.cityLabel ?? current.cityLabel).trim();
      const cityError = validatePrayerCity(cityLabel);
      if (cityError) {
        throw validationError(cityError);
      }

      const utcOffsetMinutes = input.utcOffsetMinutes ?? current.utcOffsetMinutes;
      const offsetError = validateUtcOffsetMinutes(utcOffsetMinutes);
      if (offsetError) {
        throw validationError(offsetError);
      }

      const adjustments = { ...current.adjustments };
      if (input.adjustments) {
        for (const prayer of PRAYERS) {
          const value = input.adjustments[prayer];
          if (value === undefined) {
            continue;
          }
          const adjustError = validatePrayerAdjust(value);
          if (adjustError) {
            throw validationError(adjustError);
          }
          adjustments[prayer] = value;
        }
      }

      const updated: PrayerSettings = {
        calculationMethod,
        madhab,
        latitude,
        longitude,
        cityLabel: cityLabel === '' ? current.cityLabel : cityLabel,
        utcOffsetMinutes,
        adjustments,
        remindersEnabled: input.remindersEnabled ?? current.remindersEnabled,
        updatedAt: now(),
      };

      try {
        await repo.upsertSettings(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async getDay(date: string): Promise<PrayerDay> {
      const dateError = validatePrayerDate(date);
      if (dateError) {
        throw validationError(dateError);
      }
      const settings = await loadSettings();
      // Keeps the cache bounded: days older than 60 days are never shown.
      try {
        await repo.deleteTimesBefore(addDaysIsoDate(date, -60));
      } catch (error) {
        throw databaseError(error);
      }
      return resolveDayTimes(date, settings);
    },

    async getHistory(endDate: string, dayCount: number): Promise<PrayerDay[]> {
      const dateError = validatePrayerDate(endDate);
      if (dateError) {
        throw validationError(dateError);
      }
      if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 62) {
        throw validationError('prayer_date_invalid');
      }
      const settings = await loadSettings();
      const days: PrayerDay[] = [];
      for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
        days.push(await resolveDayTimes(addDaysIsoDate(endDate, -offset), settings));
      }
      return days;
    },

    async logPrayer(date: string, prayer: PrayerName, status: PrayerStatus): Promise<PrayerLog> {
      const dateError = validatePrayerDate(date);
      if (dateError) {
        throw validationError(dateError);
      }
      const nameError = validatePrayerName(prayer);
      if (nameError) {
        throw validationError(nameError);
      }
      const statusError = validatePrayerStatus(status);
      if (statusError) {
        throw validationError(statusError);
      }

      const timestamp = now();
      const log: PrayerLog = { date, prayer, status, loggedAt: timestamp, updatedAt: timestamp };
      try {
        await repo.upsertLog(log);
      } catch (error) {
        throw databaseError(error);
      }
      return log;
    },

    async clearLog(date: string, prayer: PrayerName): Promise<boolean> {
      const dateError = validatePrayerDate(date);
      if (dateError) {
        throw validationError(dateError);
      }
      const nameError = validatePrayerName(prayer);
      if (nameError) {
        throw validationError(nameError);
      }
      try {
        return await repo.deleteLog(date, prayer);
      } catch (error) {
        throw databaseError(error);
      }
    },
  };
}
