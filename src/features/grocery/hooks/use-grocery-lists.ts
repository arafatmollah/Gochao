import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteGroceryRepository } from '@/db/repositories/grocery-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createGroceryService } from '@/services/grocery-service';
import type { GroceryListSummary } from '@/types/grocery';

import { useDebouncedValue } from '@/hooks/use-debounced-value';

export type GroceryListTab = 'active' | 'archived';

export interface UseGroceryListsResult {
  lists: GroceryListSummary[];
  loading: boolean;
  refreshing: boolean;
  /** List-level failure (replaces the list with an error state). */
  error: string | null;
  /** Transient message from a failed action, shown as a banner. */
  notice: string | null;
  clearNotice: () => void;
  tab: GroceryListTab;
  setTab: (tab: GroceryListTab) => void;
  search: string;
  setSearch: (search: string) => void;
  refresh: () => void;
  archiveList: (list: GroceryListSummary) => Promise<void>;
}

export function useGroceryLists(): UseGroceryListsResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createGroceryService(new SqliteGroceryRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();

  const [tab, setTab] = useState<GroceryListTab>('active');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);

  const [lists, setLists] = useState<GroceryListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Guards against out-of-order responses when filters change rapidly. */
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const summaries = await service.listSummaries({
        archived: tab === 'archived',
        search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      });
      if (requestIdRef.current !== requestId) return;
      setLists(summaries);
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
  }, [service, tab, debouncedSearch, t]);

  // Reloads on every focus (initial mount included), so the list is fresh
  // when returning from the add/edit modal.
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

  const archiveList = useCallback(
    async (list: GroceryListSummary) => {
      try {
        await service.setArchived(list.id, !list.isArchived);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  return {
    lists,
    loading,
    refreshing,
    error,
    notice,
    clearNotice: () => setNotice(null),
    tab,
    setTab,
    search,
    setSearch,
    refresh,
    archiveList,
  };
}
