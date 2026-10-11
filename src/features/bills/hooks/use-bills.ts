import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteBillRepository } from '@/db/repositories/bill-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createBillService } from '@/services/bill-service';
import type { BillDueItem, BillSummary } from '@/types/bill';
import { todayIsoDate } from '@/utils/dates';

import { buildDueSections, type BillDueSection } from '../grouping';

export type BillsSegment = 'due' | 'bills' | 'history';

const HISTORY_PAGE_SIZE = 50;

export interface UseBillsResult {
  segment: BillsSegment;
  setSegment: (segment: BillsSegment) => void;
  dueSections: BillDueSection[];
  dueCount: number;
  overdueCount: number;
  /** All bills (archived last) with derived schedule facts. */
  summaries: BillSummary[];
  /** Recorded payments, most recent first. */
  history: BillDueItem[];
  historyHasMore: boolean;
  today: string;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  notice: string | null;
  clearNotice: () => void;
  refresh: () => void;
  loadMoreHistory: () => void;
}

export function useBills(): UseBillsResult {
  const db = useSQLiteContext();
  const service = useMemo(() => createBillService(new SqliteBillRepository(toSqlDatabase(db))), [db]);
  const { t } = useTranslation();

  const [segment, setSegment] = useState<BillsSegment>('due');
  const [due, setDue] = useState<BillDueItem[]>([]);
  const [summaries, setSummaries] = useState<BillSummary[]>([]);
  const [history, setHistory] = useState<BillDueItem[]>([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Guards against out-of-order responses when the screen refocuses. */
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      // Materialize scheduled occurrences up to the horizon first, so the
      // due list is complete even after weeks away. Idempotent by design.
      await service.ensureOccurrencesAhead();
      const [dueItems, billSummaries, historyPage] = await Promise.all([
        service.listDue(),
        service.listSummaries({ includeArchived: true }),
        service.listHistory({ limit: HISTORY_PAGE_SIZE, offset: 0 }),
      ]);
      if (requestIdRef.current !== requestId) return;
      setDue(dueItems);
      setSummaries(billSummaries);
      setHistory(historyPage);
      setHistoryHasMore(historyPage.length === HISTORY_PAGE_SIZE);
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
  }, [service, t]);

  // Reloads on every focus (initial mount included), so the lists are fresh
  // when returning from the bill form or payment screen.
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

  const loadMoreHistory = useCallback(() => {
    if (!historyHasMore || loadingMore) {
      return;
    }
    setLoadingMore(true);
    service
      .listHistory({ limit: HISTORY_PAGE_SIZE, offset: history.length })
      .then((page) => {
        setHistory((current) => [...current, ...page]);
        setHistoryHasMore(page.length === HISTORY_PAGE_SIZE);
      })
      .catch((loadError: unknown) => setNotice(translateError(loadError, t)))
      .finally(() => setLoadingMore(false));
  }, [historyHasMore, loadingMore, service, history.length, t]);

  const today = todayIsoDate();
  const dueSections = useMemo(() => buildDueSections(due, today), [due, today]);
  const overdueCount = useMemo(() => due.filter((item) => item.dueOn < today).length, [due, today]);

  return {
    segment,
    setSegment,
    dueSections,
    dueCount: due.length,
    overdueCount,
    summaries,
    history,
    historyHasMore,
    today,
    loading,
    refreshing,
    loadingMore,
    error,
    notice,
    clearNotice: () => setNotice(null),
    refresh,
    loadMoreHistory,
  };
}
