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
