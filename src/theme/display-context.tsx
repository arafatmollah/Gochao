import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteSettingsRepository } from '@/db/repositories/settings-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';

/**
 * Display accessibility settings: text size multiplier and reduced motion.
 * Persisted in `app_settings` next to language and theme.
 */

export const TEXT_SCALES = [1, 1.15, 1.3] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export const DISPLAY_TEXT_SCALE_KEY = 'display.textScale';
export const DISPLAY_REDUCE_MOTION_KEY = 'display.reduceMotion';

export function isTextScale(value: string): value is `${TextScale}` {
  return value === '1' || value === '1.15' || value === '1.3';
}

export interface DisplayValue {
  textScale: TextScale;
  setTextScale: (scale: TextScale) => Promise<void>;
  reduceMotion: boolean;
  setReduceMotion: (enabled: boolean) => Promise<void>;
}

const fallbackValue: DisplayValue = {
  textScale: 1,
  setTextScale: async () => {},
  reduceMotion: false,
  setReduceMotion: async () => {},
};

const DisplayContext = createContext<DisplayValue>(fallbackValue);

export function DisplayProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [textScale, setTextScaleState] = useState<TextScale>(1);
  const [reduceMotion, setReduceMotionState] = useState(false);

  useEffect(() => {
    let active = true;
    const repo = new SqliteSettingsRepository(toSqlDatabase(db));
    Promise.all([repo.get(DISPLAY_TEXT_SCALE_KEY), repo.get(DISPLAY_REDUCE_MOTION_KEY)])
      .then(([storedScale, storedMotion]) => {
        if (!active) {
          return;
        }
        if (storedScale && isTextScale(storedScale)) {
          setTextScaleState(Number(storedScale) as TextScale);
        }
        if (storedMotion === '1') {
          setReduceMotionState(true);
        }
      })
      .catch(() => {
        // Defaults stand.
      });
    return () => {
      active = false;
    };
  }, [db]);

  const setTextScale = useCallback(
    async (scale: TextScale) => {
      setTextScaleState(scale);
      try {
        await new SqliteSettingsRepository(toSqlDatabase(db)).set(
          DISPLAY_TEXT_SCALE_KEY,
          String(scale),
        );
      } catch {
        // State already switched; only the restart is lost.
      }
    },
    [db],
  );

  const setReduceMotion = useCallback(
    async (enabled: boolean) => {
      setReduceMotionState(enabled);
      try {
        await new SqliteSettingsRepository(toSqlDatabase(db)).set(
          DISPLAY_REDUCE_MOTION_KEY,
          enabled ? '1' : '0',
        );
      } catch {
        // State already switched; only the restart is lost.
      }
    },
    [db],
  );

  const value = useMemo(
    () => ({ textScale, setTextScale, reduceMotion, setReduceMotion }),
    [textScale, setTextScale, reduceMotion, setReduceMotion],
  );

  return <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>;
}

export function useDisplay(): DisplayValue {
  return useContext(DisplayContext);
}
