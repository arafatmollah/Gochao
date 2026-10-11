import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteCategoryRepository } from '@/db/repositories/category-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createCategoryService } from '@/services/category-service';
import type { CategoryWithUsage } from '@/types/finance';

export interface UseCategoriesResult {
  income: CategoryWithUsage[];
  expense: CategoryWithUsage[];
  includeArchived: boolean;
  setIncludeArchived: (value: boolean) => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

/** Income and expense categories with usage counts, reloaded on focus. */
export function useCategories(): UseCategoriesResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createCategoryService(new SqliteCategoryRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();

  const [categories, setCategories] = useState<CategoryWithUsage[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (withArchived: boolean) => {
      try {
        const list = await service.listWithUsage({ includeArchived: withArchived });
        setCategories(list);
        setError(null);
      } catch (loadError) {
        setError(translateError(loadError, t));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [service, t],
  );

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await load(includeArchived);
      })();
    }, [load, includeArchived]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load(includeArchived);
  }, [load, includeArchived]);

  const chooseArchived = useCallback((value: boolean) => {
    setIncludeArchived(value);
  }, []);

  return {
    income: useMemo(() => categories.filter((item) => item.kind === 'income'), [categories]),
    expense: useMemo(() => categories.filter((item) => item.kind === 'expense'), [categories]),
    includeArchived,
    setIncludeArchived: chooseArchived,
    loading,
    refreshing,
    error,
    refresh,
  };
}
