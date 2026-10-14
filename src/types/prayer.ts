/**
 * Prayer domain types (master prompt Module I).
 *
 * Times are local wall-clock `HH:mm` text (24-hour), not instants: what the
 * user sees for a day never shifts with timezone changes. Dates are calendar
 * `YYYY-MM-DD` days.
 */

export const PRAYERS = ['tahajjud', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerName = (typeof PRAYERS)[number];

/**
 * Prayers with astronomically calculated times. Tahajjud is excluded: its
 * window is fixed by definition (midnight until Fajr), so it needs no
 * method, madhab, coordinates, or manual adjustment.
 */
export const ADJUSTABLE_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type AdjustablePrayer = (typeof ADJUSTABLE_PRAYERS)[number];

/**
 * Prayers offered in daylight, shown with the sun theme. Fajr, Maghrib, and
 * Isha fall in darkness and get the moonlit-midnight theme.
 */
export const DAY_PRAYERS: readonly PrayerName[] = ['dhuhr', 'asr'];

export function isDayPrayer(prayer: PrayerName): boolean {
  return DAY_PRAYERS.includes(prayer);
}

export const PRAYER_CALCULATION_METHODS = [
  'karachi',
  'muslimWorldLeague',
  'egyptian',
  'ummAlQura',
  'singapore',
  'dubai',
] as const;
export type PrayerCalculationMethod = (typeof PRAYER_CALCULATION_METHODS)[number];

export const PRAYER_MADHABS = ['hanafi', 'shafi'] as const;
export type PrayerMadhab = (typeof PRAYER_MADHABS)[number];

export const PRAYER_STATUSES = ['prayed', 'missed'] as const;
export type PrayerStatus = (typeof PRAYER_STATUSES)[number];

/** Dhaka, Bangladesh — the default location (UTC+6, no DST). */
export const DEFAULT_PRAYER_LATITUDE = 23.8103;
export const DEFAULT_PRAYER_LONGITUDE = 90.4125;
export const DEFAULT_PRAYER_CITY = 'Dhaka';
export const DEFAULT_PRAYER_METHOD: PrayerCalculationMethod = 'karachi';
export const DEFAULT_PRAYER_MADHAB: PrayerMadhab = 'hanafi';
/** Default location offset from UTC, in whole minutes (Dhaka, no DST). */
export const DEFAULT_PRAYER_UTC_OFFSET_MINUTES = 360;
/** Supported offset range: UTC−12:00 through UTC+14:00. */
export const PRAYER_UTC_OFFSET_MIN = -720;
export const PRAYER_UTC_OFFSET_MAX = 840;

/** Manual per-prayer adjustments are whole minutes within this range. */
export const PRAYER_ADJUST_MIN = -60;
export const PRAYER_ADJUST_MAX = 60;

export const PRAYER_CITY_MAX_LENGTH = 60;

export interface PrayerSettings {
  calculationMethod: PrayerCalculationMethod;
  madhab: PrayerMadhab;
  latitude: number;
  longitude: number;
  cityLabel: string;
  /** Location offset from UTC in whole minutes; display = instant + offset. */
  utcOffsetMinutes: number;
  /** Whole-minute manual offsets per calculated prayer (negative = earlier). */
  adjustments: Record<AdjustablePrayer, number>;
  /** Whether a notification is scheduled at each prayer time. */
  remindersEnabled: boolean;
  /** ISO-8601 UTC timestamp of the last save. */
  updatedAt: string | null;
}

export interface UpdatePrayerSettingsInput {
  calculationMethod?: PrayerCalculationMethod;
  madhab?: PrayerMadhab;
  latitude?: number;
  longitude?: number;
  cityLabel?: string;
  utcOffsetMinutes?: number;
  adjustments?: Partial<Record<AdjustablePrayer, number>>;
  remindersEnabled?: boolean;
}

export interface PrayerTime {
  prayer: PrayerName;
  /** Local wall-clock `HH:mm` (24-hour). */
  time: string;
}

export interface PrayerLog {
  date: string;
  prayer: PrayerName;
  status: PrayerStatus;
  /** ISO-8601 UTC timestamp of when the status was recorded. */
  loggedAt: string;
  /** ISO-8601 UTC timestamp of the last change. */
  updatedAt: string;
}

/** One prayer of a day: its time plus the recorded status, if any. */
export interface DayPrayer extends PrayerTime {
  status: PrayerStatus | null;
}

export interface PrayerDay {
  date: string;
  prayers: DayPrayer[];
}

/** Fingerprint of the settings that produced a cached schedule row. */
export interface PrayerCacheFingerprint {
  calcMethod: string;
  madhab: string;
  latitude: number;
  longitude: number;
}
