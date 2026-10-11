import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteBudgetRepository } from '@/db/repositories/budget-repository';
import { SqliteCategoryRepository } from '@/db/repositories/category-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createBudgetService } from '@/services/budget-service';
import type { BudgetWithUsage } from '@/types/finance';
import { monthBoundsForKey, monthKeyOf, todayIsoDate } from '@/utils/dates';

export interface UseBudgetsResult {
  budgets: BudgetWithUsage[];
  /** Current month key (`2026-10`) the usage figures belong to. */
  monthKey: string;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

/** Monthly budgets with this month's derived spending, reloaded on focus. */
export function useBudgets(): UseBudgetsResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () =>
      createBudgetService(new SqliteBudgetRepository(toSqlDatabase(db)), {
        categories: new SqliteCategoryRepository(toSqlDatabase(db)),
      }),
    [db],
  );
  const { t } = useTranslation();

  const [budgets, setBudgets] = useState<BudgetWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthKey = monthKeyOf(todayIsoDate());

  const load = useCallback(async () => {
    try {
      const bounds = monthBoundsForKey(monthKey);
      const list = await service.listWithUsage({
        startOn: bounds.startOn,
        nextStartOn: bounds.nextStartOn,
      });
      setBudgets(list);
      setError(null);
    } catch (loadError) {
      setError(translateError(loadError, t));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [service, monthKey, t]);

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

  return { budgets, monthKey, loading, refreshing, error, refresh };
}
