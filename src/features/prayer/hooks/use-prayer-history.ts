import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqlitePrayerRepository } from '@/db/repositories/prayer-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createPrayerService } from '@/services/prayer-service';
import type { PrayerDay } from '@/types/prayer';
import { todayIsoDate } from '@/utils/dates';

const HISTORY_DAYS = 14;

export interface UsePrayerHistoryResult {
  days: PrayerDay[];
  loading: boolean;
  refreshing: boolean;
  /** Screen-level failure (replaces the content with an error state). */
  error: string | null;
  refresh: () => void;
}

export function usePrayerHistory(): UsePrayerHistoryResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createPrayerService(new SqlitePrayerRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();

  const endDate = todayIsoDate();
  const [days, setDays] = useState<PrayerDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Guards against out-of-order responses on rapid refocus. */
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const loaded = await service.getHistory(endDate, HISTORY_DAYS);
      if (requestIdRef.current !== requestId) return;
      setDays(loaded);
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
  }, [service, endDate, t]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await load();
      })();
    }, [load]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  return { days, loading, refreshing, error, refresh };
}
