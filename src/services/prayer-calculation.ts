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

/** Tahajjud window opens at local midnight and runs until Fajr. */
export const TAHAJJUD_START = '00:00';
/** Minutes after sunrise until voluntary prayer resumes. */
export const SUNRISE_BUFFER_MINUTES = 20;
/** Minutes before Dhuhr during which voluntary prayer pauses (midday). */
export const MIDDAY_BUFFER_MINUTES = 10;

function loadPrayerTimes(
  date: string,
  settings: PrayerSettings,
): { times: PrayerTimes; parsed: Date } {
  const parsed = parseIsoDate(date);
  if (!parsed) {
    throw new Error(`Invalid prayer date: ${date}`);
  }
  if (!Number.isFinite(settings.latitude) || !Number.isFinite(settings.longitude)) {
    throw new Error('Invalid prayer coordinates.');
  }
  // Midday avoids any DST-boundary edge when adhan reads the Y/M/D parts.
  const midday = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12);
  return {
    times: new PrayerTimes(
      new Coordinates(settings.latitude, settings.longitude),
      midday,
      buildCalculationParameters(settings),
    ),
    parsed,
  };
}

/**
 * Calculates the daily times for a calendar day: Tahajjud (fixed at local
 * midnight) plus the five adhan-calculated prayers. Throws a plain Error
 * for an invalid date or unusable coordinates; the service converts that
 * into an `AppError`.
 */
export function calculateDayTimes(date: string, settings: PrayerSettings): PrayerTime[] {
  const { times } = loadPrayerTimes(date, settings);
  const byPrayer = {
    fajr: times.fajr,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha,
  };
  return PRAYERS.map((prayer) => ({
    prayer,
    time:
      prayer === 'tahajjud'
        ? TAHAJJUD_START
        : toWallClock(byPrayer[prayer], settings.utcOffsetMinutes),
  }));
}

/** Sunrise wall-clock for a calendar day (drives the restricted window). */
export function calculateSunrise(date: string, settings: PrayerSettings): string {
  const { times } = loadPrayerTimes(date, settings);
  return toWallClock(times.sunrise, settings.utcOffsetMinutes);
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

/**
 * Finds the currently active prayer: the last prayer whose start time has
 * passed given today's times and the current local time (`HH:mm`). Before
 * Fajr there is no active prayer (`null`); after Isha the active prayer
 * stays Isha until tomorrow's Fajr.
 */
export function findCurrentPrayer(times: PrayerTime[], nowTime: string): PrayerName | null {
  const nowMinutes = wallClockToMinutes(nowTime);
  if (nowMinutes === null) {
    return null;
  }
  let current: PrayerName | null = null;
  for (const entry of times) {
    const minutes = wallClockToMinutes(entry.time);
    if (minutes !== null && minutes <= nowMinutes) {
      current = entry.prayer;
    }
  }
  return current;
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

/** Shifts a wall-clock `HH:mm` by whole minutes, wrapping past midnight. */
export function addMinutesToWallClock(time: string, minutes: number): string | null {
  const base = wallClockToMinutes(time);
  if (base === null) {
    return null;
  }
  const shifted = ((base + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(shifted / 60)).padStart(2, '0')}:${String(shifted % 60).padStart(2, '0')}`;
}

export type RestrictedWindowId = 'after-fajr' | 'midday' | 'after-asr';

export interface RestrictedWindow {
  id: RestrictedWindowId;
  /** Window start/end as wall-clock `HH:mm`. */
  start: string;
  end: string;
}

/**
 * Voluntary-prayer pause windows for a day: after Fajr until the sun is up,
 * the minutes around solar noon before Dhuhr, and after Asr until Maghrib.
 * Windows with unparsable bounds are skipped, never fabricated.
 */
export function calculateRestrictedWindows(
  dayTimes: PrayerTime[],
  sunrise: string,
): RestrictedWindow[] {
  const at = (prayer: PrayerName): string | null =>
    dayTimes.find((entry) => entry.prayer === prayer)?.time ?? null;
  const fajr = at('fajr');
  const dhuhr = at('dhuhr');
  const asr = at('asr');
  const maghrib = at('maghrib');

  const windows: RestrictedWindow[] = [];
  if (fajr) {
    const end = addMinutesToWallClock(sunrise, SUNRISE_BUFFER_MINUTES);
    if (end) {
      windows.push({ id: 'after-fajr', start: fajr, end });
    }
  }
  if (dhuhr) {
    const start = addMinutesToWallClock(dhuhr, -MIDDAY_BUFFER_MINUTES);
    if (start) {
      windows.push({ id: 'midday', start, end: dhuhr });
    }
  }
  if (asr && maghrib) {
    windows.push({ id: 'after-asr', start: asr, end: maghrib });
  }
  return windows;
}

/**
 * End of a prayer's availability window: the next prayer's start time, so
 * e.g. Dhuhr at `11:45` followed by Asr at `15:45` is available `11:45`
 * until `15:45`. The day's last prayer has no end inside today's schedule
 * (its window runs into tomorrow's Fajr), reported as `null` so the UI
 * shows just its start time. Unknown prayers also yield `null`.
 */
export function prayerWindowEnd(times: PrayerTime[], prayer: PrayerName): string | null {  const index = times.findIndex((entry) => entry.prayer === prayer);
  if (index < 0) {
    return null;
  }
  return times[index + 1]?.time ?? null;
}
