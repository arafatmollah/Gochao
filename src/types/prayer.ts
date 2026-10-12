/**
 * Prayer domain types (master prompt Module I).
 *
 * Times are local wall-clock `HH:mm` text (24-hour), not instants: what the
 * user sees for a day never shifts with timezone changes. Dates are calendar
 * `YYYY-MM-DD` days.
 */

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerName = (typeof PRAYERS)[number];

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

/** Dhaka, Bangladesh — the default location. */
export const DEFAULT_PRAYER_LATITUDE = 23.8103;
export const DEFAULT_PRAYER_LONGITUDE = 90.4125;
export const DEFAULT_PRAYER_CITY = 'Dhaka';
export const DEFAULT_PRAYER_METHOD: PrayerCalculationMethod = 'karachi';
export const DEFAULT_PRAYER_MADHAB: PrayerMadhab = 'hanafi';

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
  /** Whole-minute manual offsets per prayer (negative = earlier). */
  adjustments: Record<PrayerName, number>;
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
  adjustments?: Partial<Record<PrayerName, number>>;
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
