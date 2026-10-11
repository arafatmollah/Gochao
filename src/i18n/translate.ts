/**
 * Minimal i18n engine (a lightweight alternative to i18next, which the master
 * prompt allows). Pure functions only — React wiring lives in `index.tsx`.
 *
 * Translation files are nested JSON keyed by dot-paths (`tasks.empty.title`).
 * Lookup order for a key in locale L:
 *   1. `key_one` / `key_other` in L (when `count` is provided),
 *   2. `key` in L,
 *   3. the same candidates in the English fallback dictionary,
 *   4. the key itself (so a missing translation degrades visibly, never crashes).
 */

export const LOCALES = ['en', 'bn'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export type TranslationParams = Record<string, string | number>;
/** Parsed locale JSON: nested objects, string values, possibly arrays. */
export type TranslationDict = Record<string, unknown>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Parses a stored language preference; unknown values fall back to default. */
export function parseLocale(value: string | null | undefined): Locale | null {
  return isLocale(value) ? value : null;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

/** Maps ASCII digits in a string to the locale's numbering system. */
export function toLocaleDigits(value: string, locale: Locale): string {
  if (locale !== 'bn') {
    return value;
  }
  return value.replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]);
}

/**
 * Formats an integer for display: thousands separators plus locale digits.
 * (Manual grouping — Hermes' Intl support is not relied upon.)
 */
export function formatNumber(value: number, locale: Locale): string {
  const rounded = Math.round(value);
  const integral = Math.abs(rounded);
  const grouped = String(integral).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = rounded < 0 ? '-' : '';
  return toLocaleDigits(`${sign}${grouped}`, locale);
}

/** Resolves a dot-path (`months.0`) against a nested dictionary. */
export function lookupKey(dict: TranslationDict, path: string): string | null {
  let node: unknown = dict;
  for (const segment of path.split('.')) {
    if (Array.isArray(node)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= node.length) {
        return null;
      }
      node = node[index];
    } else if (typeof node === 'object' && node !== null) {
      node = (node as Record<string, unknown>)[segment];
    } else {
      return null;
    }
    if (node === undefined) {
      return null;
    }
  }
  return typeof node === 'string' ? node : null;
}

export function interpolate(template: string, params: TranslationParams | undefined, locale: Locale): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      return match;
    }
    // Digits are localized but never grouped here: interpolation injects
    // values like years and counts where thousands separators would be wrong.
    // Use `formatNumber` explicitly where grouped output is wanted.
    return typeof value === 'number' ? toLocaleDigits(String(value), locale) : value;
  });
}

function pluralSuffix(count: number): 'one' | 'other' {
  return count === 1 ? 'one' : 'other';
}

export type TranslateFn = (key: string, params?: TranslationParams) => string;

/**
 * Creates a translator bound to a locale. `fallback` should be the English
 * dictionary so every key has a value even before translations land.
 */
export function createTranslator(
  locale: Locale,
  dict: TranslationDict,
  fallback: TranslationDict,
): TranslateFn {
  return (key, params) => {
    const candidates: string[] = [];
    if (params && typeof params.count === 'number') {
      candidates.push(`${key}_${pluralSuffix(params.count)}`);
    }
    candidates.push(key);

    for (const candidate of candidates) {
      const primary = lookupKey(dict, candidate);
      if (primary !== null) {
        return interpolate(primary, params, locale);
      }
    }
    for (const candidate of candidates) {
      const english = lookupKey(fallback, candidate);
      if (english !== null) {
        if (__DEV__ && locale !== DEFAULT_LOCALE) {
          console.warn(`[jibon] missing ${locale} translation: ${candidate}`);
        }
        return interpolate(english, params, locale);
      }
    }
    if (__DEV__) {
      console.warn(`[jibon] missing translation key: ${key}`);
    }
    return key;
  };
}
