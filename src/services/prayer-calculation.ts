import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
  type CalculationParameters,
} from 'adhan';

import type {
  PrayerCalculationMethod,
  PrayerName,
  PrayerSettings,
  PrayerTime,
} from '@/types/prayer';
import { PRAYERS } from '@/types/prayer';
import { parseIsoDate } from '@/utils/dates';

/**
 * Offline prayer-time calculation built on the `adhan` library (pure
 * astronomy math — no network, no native modules).
 *
 * Timezone model (the subtle part): adhan reads the input day in
 * device-local components but returns instants anchored to UTC midnight, so
 * formatting those instants with device-local getters is only correct when
 * the device sits in the prayer location's timezone. Instead every instant
 * is rendered as wall-clock through the location's `utcOffsetMinutes`
 * setting (`instant + offset`), which is exact on any device, in any
 * timezone, with no network and no tz database. The input day itself comes
 * from the caller-supplied `YYYY-MM-DD` string (device-local noon keeps the
 * Y/M/D stable across timezones), so the selected astronomical day never
 * depends on where the device happens to be.
 */

const METHOD_FACTORIES: Record<
  PrayerCalculationMethod,
  () => CalculationParameters
> = {
  karachi: () => CalculationMethod.Karachi(),
  muslimWorldLeague: () => CalculationMethod.MuslimWorldLeague(),
  egyptian: () => CalculationMethod.Egyptian(),
  ummAlQura: () => CalculationMethod.UmmAlQura(),
  singapore: () => CalculationMethod.Singapore(),
  dubai: () => CalculationMethod.Dubai(),
};

export function buildCalculationParameters(settings: PrayerSettings): CalculationParameters {
  const params = METHOD_FACTORIES[settings.calculationMethod]();
  params.madhab = settings.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.adjustments = {
    fajr: settings.adjustments.fajr,
    sunrise: 0,
    dhuhr: settings.adjustments.dhuhr,
    asr: settings.adjustments.asr,
    maghrib: settings.adjustments.maghrib,
    isha: settings.adjustments.isha,
  };
  return params;
}

function toWallClock(instant: Date, utcOffsetMinutes: number): string {
  const shifted =
    (instant.getUTCHours() * 60 + instant.getUTCMinutes() + utcOffsetMinutes) % 1440;
  const normalized = ((shifted % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Calculates the five daily times for a calendar day. Throws a plain Error
 * for an invalid date or unusable coordinates; the service converts that
 * into an `AppError`.
 */
export function calculateDayTimes(date: string, settings: PrayerSettings): PrayerTime[] {
  const parsed = parseIsoDate(date);
  if (!parsed) {
    throw new Error(`Invalid prayer date: ${date}`);
  }
  if (!Number.isFinite(settings.latitude) || !Number.isFinite(settings.longitude)) {
    throw new Error('Invalid prayer coordinates.');
  }
  // Midday avoids any DST-boundary edge when adhan reads the Y/M/D parts.
  const midday = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12);
  const times = new PrayerTimes(
    new Coordinates(settings.latitude, settings.longitude),
    midday,
    buildCalculationParameters(settings),
  );
  const byPrayer: Record<PrayerName, Date> = {
    fajr: times.fajr,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha,
  };
  return PRAYERS.map((prayer) => ({
    prayer,
    time: toWallClock(byPrayer[prayer], settings.utcOffsetMinutes),
  }));
}

/** Current device-local wall-clock `HH:mm`. */
export function nowWallClock(from: Date = new Date()): string {
  return `${String(from.getHours()).padStart(2, '0')}:${String(from.getMinutes()).padStart(2, '0')}`;
}

/** Parses an `HH:mm` wall-clock time on a calendar day into minutes of day. */
export function wallClockToMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Finds the next upcoming prayer given today's times and the current local
 * time (`HH:mm`). After Isha, the next prayer is tomorrow's Fajr, reported
 * as `null` here so the UI can roll the schedule forward a day.
 */
export function findNextPrayer(times: PrayerTime[], nowTime: string): PrayerName | null {
  const nowMinutes = wallClockToMinutes(nowTime);
  if (nowMinutes === null) {
    return times[0]?.prayer ?? null;
  }
  for (const entry of times) {
    const minutes = wallClockToMinutes(entry.time);
    if (minutes !== null && minutes > nowMinutes) {
      return entry.prayer;
    }
  }
  return null;
}

/** Whole minutes from `fromTime` until `toTime` (both `HH:mm`). */
export function minutesUntil(fromTime: string, toTime: string): number | null {
  const from = wallClockToMinutes(fromTime);
  const to = wallClockToMinutes(toTime);
  if (from === null || to === null) {
    return null;
  }
  return to - from;
}
