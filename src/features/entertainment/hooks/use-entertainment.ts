import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';

import { SqliteWatchlistRepository } from '@/db/repositories/entertainment-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { SPOTLIGHT_ACCLAIMED, SPOTLIGHT_UPCOMING } from '@/features/entertainment/catalog';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createEntertainmentService } from '@/services/entertainment-service';
import type {
  SpotlightEntry,
  WatchItem,
  WatchKind,
  WatchStatus,
} from '@/types/entertainment';

import { useDebouncedValue } from '@/hooks/use-debounced-value';

export type EntertainmentSegment = 'watchlist' | 'discover';
export type WatchStatusFilter = WatchStatus | 'all';

export interface SpotlightWithSaved extends SpotlightEntry {
  saved: boolean;
}

export interface UseEntertainmentResult {
  segment: EntertainmentSegment;
  setSegment: (segment: EntertainmentSegment) => void;

  items: WatchItem[];
  upcoming: SpotlightWithSaved[];
  acclaimed: SpotlightWithSaved[];
  loading: boolean;
  refreshing: boolean;
  /** List-level failure (replaces the content with an error state). */
  error: string | null;
  /** Transient message from a failed action, shown as a banner. */
  notice: string | null;
  clearNotice: () => void;

  search: string;
  setSearch: (search: string) => void;
  statusFilter: WatchStatusFilter;
  setStatusFilter: (filter: WatchStatusFilter) => void;
  kindFilter: WatchKind | null;
  setKindFilter: (kind: WatchKind | null) => void;

  refresh: () => void;
  saveSpotlight: (entry: SpotlightEntry) => Promise<void>;
  setStatus: (item: WatchItem, status: WatchStatus) => Promise<void>;
  removeItem: (item: WatchItem) => Promise<void>;
  openLink: (url: string) => Promise<void>;
}

export function useEntertainment(): UseEntertainmentResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createEntertainmentService(new SqliteWatchlistRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();

  const [segment, setSegment] = useState<EntertainmentSegment>('watchlist');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [statusFilter, setStatusFilter] = useState<WatchStatusFilter>('all');
  const [kindFilter, setKindFilter] = useState<WatchKind | null>(null);

  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Guards against out-of-order responses when filters change rapidly. */
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const listed = await service.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        kind: kindFilter ?? undefined,
        search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      });
      if (requestIdRef.current !== requestId) return;
      setItems(listed);
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
  }, [service, statusFilter, kindFilter, debouncedSearch, t]);

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

  const savedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of items) {
      keys.add(`${item.kind}::${item.title.trim().toLowerCase()}`);
    }
    return keys;
  }, [items]);

  const markSaved = useCallback(
    (entries: readonly SpotlightEntry[]): SpotlightWithSaved[] =>
      entries.map((entry) => ({
        ...entry,
        saved: savedKeys.has(`${entry.kind}::${entry.title.trim().toLowerCase()}`),
      })),
    [savedKeys],
  );

  const saveSpotlight = useCallback(
    async (entry: SpotlightEntry) => {
      try {
        await service.saveSpotlight(entry.title, entry.kind);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  const setStatus = useCallback(
    async (item: WatchItem, status: WatchStatus) => {
      try {
        await service.setStatus(item.id, status);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  const removeItem = useCallback(
    async (item: WatchItem) => {
      try {
        await service.remove(item.id);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  const openLink = useCallback(async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setNotice(t('errors.generic'));
    }
  }, [t]);

  return {
    segment,
    setSegment,
    items,
    upcoming: markSaved(SPOTLIGHT_UPCOMING),
    acclaimed: markSaved(SPOTLIGHT_ACCLAIMED),
    loading,
    refreshing,
    error,
    notice,
    clearNotice: () => setNotice(null),
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    kindFilter,
    setKindFilter,
    refresh,
    saveSpotlight,
    setStatus,
    removeItem,
    openLink,
  };
}
