import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteGroceryRepository } from '@/db/repositories/grocery-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createGroceryService } from '@/services/grocery-service';
import type {
  GroceryItemStatusFilter,
  GroceryItemWithMember,
  GroceryList,
} from '@/types/grocery';

import { useDebouncedValue } from '@/hooks/use-debounced-value';

export interface UseGroceryDetailResult {
  list: GroceryList | null;
  items: GroceryItemWithMember[];
  /** Total items of the list (ignores the display filter). */
  totalItems: number;
  /** Items not yet purchased (ignores the display filter). */
  remainingCount: number;
  estimatedTotalMinor: number;
  actualTotalMinor: number;
  loading: boolean;
  refreshing: boolean;
  /** Screen-level failure (replaces the content with an error state). */
  error: string | null;
  /** Transient message from a failed action, shown as a banner. */
  notice: string | null;
  clearNotice: () => void;
  statusFilter: GroceryItemStatusFilter;
  setStatusFilter: (filter: GroceryItemStatusFilter) => void;
  search: string;
  setSearch: (search: string) => void;
  refresh: () => void;
  togglePurchased: (item: GroceryItemWithMember) => Promise<void>;
  removeItem: (item: GroceryItemWithMember) => Promise<void>;
  toggleArchived: () => Promise<void>;
}

export function useGroceryDetail(listId: string | null): UseGroceryDetailResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createGroceryService(new SqliteGroceryRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();

  const [statusFilter, setStatusFilter] = useState<GroceryItemStatusFilter>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);

  const [list, setList] = useState<GroceryList | null>(null);
  const [items, setItems] = useState<GroceryItemWithMember[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [remainingCount, setRemainingCount] = useState(0);
  const [estimatedTotalMinor, setEstimatedTotalMinor] = useState(0);
  const [actualTotalMinor, setActualTotalMinor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Guards against out-of-order responses when filters change rapidly. */
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!listId) {
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    try {
      const [loadedList, loadedItems, total, remaining, totals] = await Promise.all([
        service.getListById(listId),
        service.listItems(listId, {
          purchased:
            statusFilter === 'all' ? undefined : statusFilter === 'purchased',
          search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
        }),
        service.countItems(listId),
        service.countRemaining(listId),
        service.sumTotals(listId),
      ]);
      if (requestIdRef.current !== requestId) return;
      setList(loadedList);
      setItems(loadedItems);
      setTotalItems(total);
      setRemainingCount(remaining);
      setEstimatedTotalMinor(totals.estimatedTotalMinor);
      setActualTotalMinor(totals.actualTotalMinor);
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
  }, [service, listId, statusFilter, debouncedSearch, t]);

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

  const togglePurchased = useCallback(
    async (item: GroceryItemWithMember) => {
      try {
        await service.setPurchased(item.id, !item.isPurchased);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  const removeItem = useCallback(
    async (item: GroceryItemWithMember) => {
      try {
        await service.removeItem(item.id);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  const toggleArchived = useCallback(async () => {
    if (!list) {
      return;
    }
    try {
      const updated = await service.setArchived(list.id, !list.isArchived);
      setList(updated);
    } catch (actionError) {
      setNotice(translateError(actionError, t));
    }
  }, [service, list, t]);

  return {
    list,
    items,
    totalItems,
    remainingCount,
    estimatedTotalMinor,
    actualTotalMinor,
    loading,
    refreshing,
    error,
    notice,
    clearNotice: () => setNotice(null),
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    refresh,
    togglePurchased,
    removeItem,
    toggleArchived,
  };
}
