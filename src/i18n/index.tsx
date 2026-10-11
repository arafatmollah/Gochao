import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { LANGUAGE_SETTING_KEY, SqliteSettingsRepository } from '@/db/repositories/settings-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';

import bnDict from './locales/bn.json';
import enDict from './locales/en.json';
import {
  createTranslator,
  DEFAULT_LOCALE,
  parseLocale,
  type Locale,
  type TranslateFn,
  type TranslationDict,
} from './translate';

export type { Locale, TranslateFn } from './translate';
export { formatNumber, isLocale, LOCALES, toLocaleDigits } from './translate';

const DICTIONARIES: Record<Locale, TranslationDict> = {
  en: enDict as TranslationDict,
  bn: bnDict as TranslationDict,
};

export interface I18nValue {
  locale: Locale;
  /** Switches the language immediately and persists the preference. */
  setLocale: (locale: Locale) => Promise<void>;
  t: TranslateFn;
}

const fallbackTranslator = createTranslator(
  DEFAULT_LOCALE,
  DICTIONARIES[DEFAULT_LOCALE],
  DICTIONARIES.en,
);

/**
 * Defaults to English so components render correctly outside the provider
 * (unit tests, pre-database boot screens). The provider upgrades the value
 * once the stored preference is read.
 */
const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  setLocale: async () => {},
  t: fallbackTranslator,
});

export function useTranslation(): I18nValue {
  return useContext(I18nContext);
}

export interface I18nProviderProps {
  children: ReactNode;
  /** Fires once the stored language preference has been read (or failed). */
  onReady?: () => void;
}

/**
 * Loads the persisted language from `app_settings` and exposes translation.
 * Renders children immediately with the default locale; `onReady` lets the
 * app hold its startup overlay until the preference is resolved, so a saved
 * Bangla preference never flashes English.
 */
export function I18nProvider({ children, onReady }: I18nProviderProps) {
  const db = useSQLiteContext();
  const settings = useMemo(() => new SqliteSettingsRepository(toSqlDatabase(db)), [db]);
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    settings
      .get(LANGUAGE_SETTING_KEY)
      .then((stored) => {
        if (!active) return;
        const saved = parseLocale(stored);
        if (saved && saved !== DEFAULT_LOCALE) {
          setLocaleState(saved);
        }
      })
      .catch((error: unknown) => {
        // A missing or unreadable preference must never block the app.
        if (__DEV__) {
          console.warn('[jibon] could not read language preference:', error);
        }
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [settings]);

  useEffect(() => {
    if (ready) {
      onReady?.();
    }
  }, [ready, onReady]);

  const setLocale = useCallback(
    async (next: Locale) => {
      setLocaleState(next);
      try {
        await settings.set(LANGUAGE_SETTING_KEY, next);
      } catch (error) {
        // The in-memory switch still applies; only persistence failed.
        if (__DEV__) {
          console.warn('[jibon] could not save language preference:', error);
        }
      }
    },
    [settings],
  );

  const t = useMemo(() => createTranslator(locale, DICTIONARIES[locale], DICTIONARIES.en), [locale]);
  const value = useMemo<I18nValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
