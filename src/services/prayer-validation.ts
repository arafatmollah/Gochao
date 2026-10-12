import {
  PRAYERS,
  PRAYER_ADJUST_MAX,
  PRAYER_ADJUST_MIN,
  PRAYER_CALCULATION_METHODS,
  PRAYER_CITY_MAX_LENGTH,
  PRAYER_MADHABS,
  PRAYER_STATUSES,
  PRAYER_UTC_OFFSET_MAX,
  PRAYER_UTC_OFFSET_MIN,
} from '@/types/prayer';
import { isValidIsoDate } from '@/utils/dates';
import { normalizeDigitInput } from '@/utils/money';

/**
 * Shared prayer validation rules, used both by the settings form
 * (field-level feedback) and by the prayer service (authoritative check
 * before persisting).
 *
 * Validators return a stable machine-readable code (or null when valid).
 * The UI translates codes into localized copy via `translateValidationCode`;
 * services wrap them in `AppError('validation', code)`.
 */

export type PrayerValidationCode =
  | 'prayer_method_invalid'
  | 'prayer_madhab_invalid'
  | 'prayer_latitude_invalid'
  | 'prayer_longitude_invalid'
  | 'prayer_city_too_long'
  | 'prayer_timezone_invalid'
  | 'prayer_adjust_invalid'
  | 'prayer_date_invalid'
  | 'prayer_name_invalid'
  | 'prayer_status_invalid';

export function validatePrayerMethod(method: string): PrayerValidationCode | null {
  if (!(PRAYER_CALCULATION_METHODS as readonly string[]).includes(method)) {
    return 'prayer_method_invalid';
  }
  return null;
}

export function validatePrayerMadhab(madhab: string): PrayerValidationCode | null {
  if (!(PRAYER_MADHABS as readonly string[]).includes(madhab)) {
    return 'prayer_madhab_invalid';
  }
  return null;
}

export function validatePrayerLatitude(latitude: unknown): PrayerValidationCode | null {
  if (typeof latitude !== 'number' || !Number.isFinite(latitude)) {
    return 'prayer_latitude_invalid';
  }
  if (latitude < -90 || latitude > 90) {
    return 'prayer_latitude_invalid';
  }
  return null;
}

export function validatePrayerLongitude(longitude: unknown): PrayerValidationCode | null {
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) {
    return 'prayer_longitude_invalid';
  }
  if (longitude < -180 || longitude > 180) {
    return 'prayer_longitude_invalid';
  }
  return null;
}

export function validatePrayerCity(city: string | null | undefined): PrayerValidationCode | null {
  if (city == null || city.trim() === '') {
    return null;
  }
  if (city.trim().length > PRAYER_CITY_MAX_LENGTH) {
    return 'prayer_city_too_long';
  }
  return null;
}

/** Manual adjustments are whole minutes within the documented range. */
export function validatePrayerAdjust(
  adjustMinutes: unknown,
): PrayerValidationCode | null {
  if (typeof adjustMinutes !== 'number' || !Number.isInteger(adjustMinutes)) {
    return 'prayer_adjust_invalid';
  }
  if (adjustMinutes < PRAYER_ADJUST_MIN || adjustMinutes > PRAYER_ADJUST_MAX) {
    return 'prayer_adjust_invalid';
  }
  return null;
}

export function validatePrayerDate(date: string | null | undefined): PrayerValidationCode | null {
  if (typeof date !== 'string' || !isValidIsoDate(date)) {
    return 'prayer_date_invalid';
  }
  return null;
}

export function validatePrayerName(prayer: string): PrayerValidationCode | null {
  if (!(PRAYERS as readonly string[]).includes(prayer)) {
    return 'prayer_name_invalid';
  }
  return null;
}

export function validatePrayerStatus(status: string): PrayerValidationCode | null {
  if (!(PRAYER_STATUSES as readonly string[]).includes(status)) {
    return 'prayer_status_invalid';
  }
  return null;
}

/**
 * Parses user-typed coordinate text (accepts Bangla digits, trims
 * whitespace). Returns null when the text is not a plain decimal number.
 */
export function parseCoordinateInput(value: string): number | null {
  const normalized = normalizeDigitInput(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parses a whole-minute adjustment (`-5`, `+10`, `0`). Null when unusable. */
export function parseAdjustInput(value: string): number | null {
  const normalized = normalizeDigitInput(value).trim().replace(/^\+/, '');
  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < PRAYER_ADJUST_MIN || parsed > PRAYER_ADJUST_MAX) {
    return null;
  }
  return parsed;
}

export function validateUtcOffsetMinutes(offset: unknown): PrayerValidationCode | null {
  if (typeof offset !== 'number' || !Number.isInteger(offset)) {
    return 'prayer_timezone_invalid';
  }
  if (offset < PRAYER_UTC_OFFSET_MIN || offset > PRAYER_UTC_OFFSET_MAX) {
    return 'prayer_timezone_invalid';
  }
  return null;
}

/**
 * Parses a UTC offset as typed by a user: decimal hours (`6`, `+6`, `-4`,
 * `5.5`) or `H:MM` (`+5:30`, `-3:30`). Returns whole minutes, or null when
 * the text is unusable or outside UTC−12:00…UTC+14:00.
 */
export function parseUtcOffsetInput(value: string): number | null {
  const normalized = normalizeDigitInput(value).trim().replace(/^\+/, '');
  const entirety = /^(-?\d+)(?::([0-5]\d))?$/.exec(normalized);
  const decimal = /^(-?\d+(?:\.\d+)?)$/.exec(normalized);
  let minutes: number | null = null;
  if (entirety) {
    const hours = Number(entirety[1]);
    const mins = entirety[2] === undefined ? 0 : Number(entirety[2]);
    const sign = normalized.startsWith('-') ? -1 : 1;
    minutes = sign * (Math.abs(hours) * 60 + mins);
  } else if (decimal) {
    minutes = Math.round(Number(decimal[1]) * 60);
  }
  if (minutes === null || !Number.isSafeInteger(minutes)) {
    return null;
  }
  return validateUtcOffsetMinutes(minutes) === null ? minutes : null;
}

/** Formats whole minutes back to input text (`360` -> `+6`, `330` -> `+5:30`). */
export function formatUtcOffsetInput(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  return remainder === 0 ? `${sign}${hours}` : `${sign}${hours}:${String(remainder).padStart(2, '0')}`;
}
