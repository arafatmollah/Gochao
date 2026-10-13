import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteSettingsRepository, THEME_SETTING_KEY } from '@/db/repositories/settings-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';

import { DEFAULT_THEME, THEMES, isThemeId, type ThemeId } from './themes';
import type { ThemeColors } from './tokens';

export interface AppThemeValue {
  theme: ThemeId;
  colors: ThemeColors;
  /** Persists the choice; the whole UI re-renders with the new palette. */
  setTheme: (theme: ThemeId) => Promise<void>;
}

const fallbackValue: AppThemeValue = {
  theme: DEFAULT_THEME,
  colors: THEMES[DEFAULT_THEME],
  setTheme: async () => {},
};

const AppThemeContext = createContext<AppThemeValue>(fallbackValue);

/**
 * Theme provider. The palette lives in `app_settings` next to the language
 * preference, so it survives restarts with no schema migration. Renders the
 * default theme until the stored choice loads.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    let active = true;
    const repo = new SqliteSettingsRepository(toSqlDatabase(db));
    repo
      .get(THEME_SETTING_KEY)
      .then((stored) => {
        if (!active) {
          return;
        }
        if (stored && isThemeId(stored)) {
          setThemeState(stored);
        }
      })
      .catch(() => {
        // Corrupt settings table: stay on the default theme.
      });
    return () => {
      active = false;
    };
  }, [db]);

  const setTheme = useCallback(
    async (next: ThemeId) => {
      setThemeState(next);
      try {
        await new SqliteSettingsRepository(toSqlDatabase(db)).set(THEME_SETTING_KEY, next);
      } catch {
        // State already switched; a persist failure only loses the restart.
      }
    },
    [db],
  );

  const colors = useMemo(() => THEMES[theme], [theme]);
  const value = useMemo(() => ({ theme, colors, setTheme }), [theme, colors, setTheme]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeValue {
  return useContext(AppThemeContext);
}
