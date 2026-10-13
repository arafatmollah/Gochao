import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqlitePrayerRepository } from '@/db/repositories/prayer-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { findCurrentPrayer, findNextPrayer, minutesUntil, nowWallClock, prayerWindowEnd } from '@/services/prayer-calculation';
import { createPrayerService } from '@/services/prayer-service';
import type { PrayerDay, PrayerName, PrayerStatus } from '@/types/prayer';
import { todayIsoDate } from '@/utils/dates';

export interface NextPrayerInfo {
  prayer: PrayerName;
  time: string;
  /** Whole minutes until it starts (from the last clock tick). */
  minutesLeft: number;
}

export interface CurrentPrayerInfo {
  prayer: PrayerName;
  /** This prayer's start time (wall-clock `HH:mm`). */
  time: string;
  /**
   * End of the availability window (the next prayer's start), or null for
   * the day's last prayer whose window runs into tomorrow's Fajr.
   */
  endTime: string | null;
}

export interface UsePrayerDayResult {
  date: string;
  day: PrayerDay | null;
  /** Next upcoming prayer today, or null after Isha. */
  next: NextPrayerInfo | null;
  /** Currently active prayer window, or null before Fajr. */
  current: CurrentPrayerInfo | null;
  prayedCount: number;
  loading: boolean;
  refreshing: boolean;
  /** Screen-level failure (replaces the content with an error state). */
  error: string | null;
  /** Transient message from a failed action, shown as a banner. */
  notice: string | null;
  clearNotice: () => void;
  refresh: () => void;
  /** Cycles none -> prayed -> missed -> none for a prayer. */
  cycleStatus: (prayer: PrayerName) => Promise<void>;
}

export function usePrayerDay(): UsePrayerDayResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createPrayerService(new SqlitePrayerRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();

  const date = todayIsoDate();
  const [day, setDay] = useState<PrayerDay | null>(null);
  const [clockTick, setClockTick] = useState(() => nowWallClock());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Guards against out-of-order responses on rapid refocus. */
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const loaded = await service.getDay(date);
      if (requestIdRef.current !== requestId) return;
      setDay(loaded);
      setError(null);
    } catch (loadError) {
      if (requestIdRef.current !== requestId) return;
      setError(translateError(loadError, t));
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [service, date, t]);

  // Reloads on every focus (initial mount included), so the view is fresh
  // when returning from settings. The minute tick keeps the "next prayer"
  // countdown honest while the screen stays open.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await load();
      })();
    }, [load]),
  );

  useEffect(() => {
    const timer = setInterval(() => setClockTick(nowWallClock()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const cycleStatus = useCallback(
    async (prayer: PrayerName) => {
      const current = day?.prayers.find((entry) => entry.prayer === prayer)?.status ?? null;
      const nextStatus: PrayerStatus | null =
        current === null ? 'prayed' : current === 'prayed' ? 'missed' : null;
      try {
        if (nextStatus === null) {
          await service.clearLog(date, prayer);
        } else {
          await service.logPrayer(date, prayer, nextStatus);
        }
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, date, day, load, t],
  );

  const next = useMemo<NextPrayerInfo | null>(() => {
    if (!day) {
      return null;
    }
    // First prayer still in the future; null after Isha (tomorrow's Fajr
    // belongs to tomorrow's schedule).
    const upcoming = findNextPrayer(
      day.prayers.map(({ prayer, time }) => ({ prayer, time })),
      clockTick,
    );
    if (upcoming === null) {
      return null;
    }
    const entry = day.prayers.find((item) => item.prayer === upcoming);
    const minutesLeft = entry ? minutesUntil(clockTick, entry.time) : null;
    if (!entry || minutesLeft === null || minutesLeft < 0) {
      return null;
    }
    return { prayer: upcoming, time: entry.time, minutesLeft };
  }, [day, clockTick]);

  const prayedCount = useMemo(
    () => day?.prayers.filter((entry) => entry.status === 'prayed').length ?? 0,
    [day],
  );

  const current = useMemo<CurrentPrayerInfo | null>(() => {
    if (!day) {
      return null;
    }
    const times = day.prayers.map(({ prayer, time }) => ({ prayer, time }));
    const active = findCurrentPrayer(times, clockTick);
    if (active === null) {
      return null;
    }
    const entry = day.prayers.find((item) => item.prayer === active);
    if (!entry) {
      return null;
    }
    return { prayer: active, time: entry.time, endTime: prayerWindowEnd(times, active) };
  }, [day, clockTick]);

  return {
    date,
    day,
    next,
    current,
    prayedCount,
    loading,
    refreshing,
    error,
    notice,
    clearNotice: () => setNotice(null),
    refresh,
    cycleStatus,
  };
}
