import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteAccountRepository } from '@/db/repositories/account-repository';
import { SqliteCategoryRepository } from '@/db/repositories/category-repository';
import { SqliteTransactionRepository } from '@/db/repositories/transaction-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createTransactionService } from '@/services/transaction-service';
import type { ActivityKind, ActivityRow } from '@/types/finance';
import { monthKeyOf, todayIsoDate } from '@/utils/dates';

/**
 * One month of the feed with its own income/expense subtotals. Subtotals are
 * summed from the loaded rows (transfers never counted) — exact within the
 * fetch cap below.
 */
export interface ActivityMonthSection {
  key: string;
  data: ActivityRow[];
  incomeMinor: number;
  expenseMinor: number;
}

export type ActivityKindFilter = 'all' | ActivityKind;

/** Recent feed is capped; reports are the authoritative long-range surface. */
const ACTIVITY_FETCH_LIMIT = 500;

export interface UseTransactionsResult {
  kind: ActivityKindFilter;
  setKind: (kind: ActivityKindFilter) => void;
  search: string;
  setSearch: (value: string) => void;
  filtersActive: boolean;
  clearFilters: () => void;
  sections: ActivityMonthSection[];
  /** Row count before client-side search/kind filtering. */
  loadedCount: number;
  today: string;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTransactions(): UseTransactionsResult {
  const db = useSQLiteContext();
  const service = useMemo(() => {
    const sql = toSqlDatabase(db);
    return createTransactionService(new SqliteTransactionRepository(sql), {
      accounts: new SqliteAccountRepository(sql),
      categories: new SqliteCategoryRepository(sql),
    });
  }, [db]);
  const { t } = useTranslation();

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [kind, setKind] = useState<ActivityKindFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await service.listActivity({ limit: ACTIVITY_FETCH_LIMIT });
      setRows(list);
      setError(null);
    } catch (loadError) {
      setError(translateError(loadError, t));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [service, t]);

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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (kind !== 'all' && row.kind !== kind) {
        return false;
      }
      if (query.length === 0) {
        return true;
      }
      const haystack = [row.description ?? '', row.notes ?? '', row.accountName, row.toAccountName ?? '', row.categoryName ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, kind, search]);

  const sections = useMemo(() => {
    const byMonth = new Map<string, ActivityMonthSection>();
    for (const row of filtered) {
      const key = monthKeyOf(row.occurredOn);
      let section = byMonth.get(key);
      if (!section) {
        section = { key, data: [], incomeMinor: 0, expenseMinor: 0 };
        byMonth.set(key, section);
      }
      section.data.push(row);
      if (row.kind === 'income') {
        section.incomeMinor += row.amountMinor;
      } else if (row.kind === 'expense') {
        section.expenseMinor += row.amountMinor;
      }
    }
    // Rows arrive newest first, so insertion order already runs newest month
    // to oldest.
    return [...byMonth.values()];
  }, [filtered]);

  const clearFilters = useCallback(() => {
    setKind('all');
    setSearch('');
  }, []);

  return {
    kind,
    setKind,
    search,
    setSearch,
    filtersActive: kind !== 'all' || search.trim().length > 0,
    clearFilters,
    sections,
    loadedCount: rows.length,
    today: todayIsoDate(),
    loading,
    refreshing,
    error,
    refresh,
  };
}
