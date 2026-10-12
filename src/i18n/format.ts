/**
 * Locale-aware display formatting built on the translator (`t`) plus the
 * pure date helpers. Kept separate from the React provider so screens and
 * tests can use them with any translator instance.
 */

import { daysBetweenIsoDates, parseIsoDate } from '@/utils/dates';

import {
  formatNumber,
  toLocaleDigits,
  type Locale,
  type TranslateFn,
} from './translate';

/**
 * Formats integer minor units (poisha) as BDT display text, e.g.
 * `125000` -> `৳1,250` and `125050` -> `৳1,250.50`. The poisha part is
 * shown only when non-zero; the taka part is grouped and digit-mapped per
 * locale. Money stays integer minor units everywhere else (never floats).
 */
export function formatMoney(minor: number, locale: Locale): string {
  const rounded = Math.round(minor);
  const negative = rounded < 0;
  const absolute = Math.abs(rounded);
  const taka = Math.floor(absolute / 100);
  const poisha = absolute % 100;
  const takaText = formatNumber(taka, locale);
  const valueText =
    poisha === 0
      ? takaText
      : `${takaText}.${toLocaleDigits(String(poisha).padStart(2, '0'), locale)}`;
  return `${negative ? '-' : ''}৳${valueText}`;
}

/** e.g. `2026-10-11` -> `October 11, 2026` / `১১ অক্টোবর ২০২৬`. */
export function formatIsoDateDisplay(value: string, t: TranslateFn): string {
  const date = parseIsoDate(value);
  if (!date) {
    return value;
  }
  return t('dates.display', {
    month: t(`dates.months.${date.getMonth()}`),
    day: date.getDate(),
    year: date.getFullYear(),
  });
}

/** `Today`, `Tomorrow`, `Yesterday`, or the formatted date. */
export function formatIsoDateRelative(
  value: string,
  today: string,
  t: TranslateFn,
): string {
  const diff = daysBetweenIsoDates(today, value);
  if (diff === 0) return t('dates.today');
  if (diff === 1) return t('dates.tomorrow');
  if (diff === -1) return t('dates.yesterday');
  return formatIsoDateDisplay(value, t);
}

/** e.g. `2026-10-11` -> `Sunday, October 11` / `রবিবার, ১১ অক্টোবর`. */
export function formatIsoDateWeekday(value: string, t: TranslateFn): string {
  const date = parseIsoDate(value);
  if (!date) {
    return value;
  }
  return t('dates.weekdayDisplay', {
    weekday: t(`dates.weekdays.${date.getDay()}`),
    day: date.getDate(),
    month: t(`dates.months.${date.getMonth()}`),
  });
}

/**
 * Formats a non-negative second count as a stopwatch `HH:MM:SS` string, e.g.
 * `7384` -> `02:03:04`. Digits follow the locale. Used for live prayer
 * countdowns; negative input clamps to zero.
 */
export function formatCountdownHMS(totalSeconds: number, locale: Locale): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const pad = (value: number) => toLocaleDigits(String(value).padStart(2, '0'), locale);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Formats wall-clock `HH:mm` (24-hour) as 12-hour time, e.g. `18:10` ->
 * `6:10 PM` and `04:45` -> `4:45 AM`. Digits follow the locale; the
 * AM/PM marker stays Latin, matching common Bangladeshi app convention.
 * Returns the input unchanged when it is not a valid wall-clock time.
 */
export function formatWallClock12(time: string, locale: Locale): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    return time;
  }
  const hours24 = Number(match[1]);
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${toLocaleDigits(String(hours12), locale)}:${toLocaleDigits(match[2], locale)} ${suffix}`;
}

export type GreetingKey =
  | 'dashboard.greetingMorning'
  | 'dashboard.greetingAfternoon'
  | 'dashboard.greetingEvening';

/** Time-of-day greeting for the dashboard header (local device clock). */
export function greetingKeyForHour(hour: number): GreetingKey {
  if (hour >= 4 && hour < 12) {
    return 'dashboard.greetingMorning';
  }
  if (hour >= 12 && hour < 18) {
    return 'dashboard.greetingAfternoon';
  }
  return 'dashboard.greetingEvening';
}
