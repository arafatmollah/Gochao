import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteTaskRepository } from '@/db/repositories/task-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createTaskService } from '@/services/task-service';
import type { Task, TaskPriority } from '@/types/task';
import { todayIsoDate } from '@/utils/dates';

import { useDebouncedValue } from '@/hooks/use-debounced-value';

import { buildActiveSections, buildCompletedSection, type TaskSection } from '../grouping';

export type TaskStatusFilter = 'active' | 'completed';

const RECENT_COMPLETED_LIMIT = 10;
const COMPLETED_PAGE_SIZE = 50;

export interface UseTasksResult {
  sections: TaskSection[];
  activeCount: number;
  overdueCount: number;
  today: string;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  /** List-level failure (replaces the list with an error state). */
  error: string | null;
  /** Transient message from a failed action, shown as a banner. */
  notice: string | null;
  clearNotice: () => void;
  statusFilter: TaskStatusFilter;
  setStatusFilter: (filter: TaskStatusFilter) => void;
  priorityFilter: TaskPriority | null;
  setPriorityFilter: (priority: TaskPriority | null) => void;
  search: string;
  setSearch: (search: string) => void;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
  toggleComplete: (task: Task) => Promise<void>;
  removeTask: (task: Task) => Promise<void>;
}

export function useTasks(): UseTasksResult {
  const db = useSQLiteContext();
  const service = useMemo(() => createTaskService(new SqliteTaskRepository(toSqlDatabase(db))), [db]);
  const { t } = useTranslation();

  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('active');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);

  const [pending, setPending] = useState<Task[]>([]);
  const [recentCompleted, setRecentCompleted] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Task[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Guards against out-of-order responses when filters change rapidly. */
  const requestIdRef = useRef(0);

  const load = useCallback(
    async () => {
      // Every setState here runs after an await so the initial load never
      // triggers a synchronous re-render from the effect that starts it.
      const requestId = ++requestIdRef.current;
      const base = {
        priority: priorityFilter ?? undefined,
        search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      };

      try {
        if (statusFilter === 'active') {
          const [pendingTasks, completedTasks] = await Promise.all([
            service.list({ ...base, status: 'pending' }),
            service.list({ ...base, status: 'completed', limit: RECENT_COMPLETED_LIMIT }),
          ]);
          if (requestIdRef.current !== requestId) return;
          setPending(pendingTasks);
          setRecentCompleted(completedTasks);
        } else {
          const page = await service.list({
            ...base,
            status: 'completed',
            limit: COMPLETED_PAGE_SIZE,
            offset: 0,
          });
          if (requestIdRef.current !== requestId) return;
          setCompleted(page);
          setHasMore(page.length === COMPLETED_PAGE_SIZE);
        }
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
    },
    [service, statusFilter, priorityFilter, debouncedSearch, t],
  );

  // Reloads on every focus (initial mount included), so the list is fresh
  // when returning from the add/edit modal. The async IIFE keeps setState
  // out of the synchronous effect body.
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

  const loadMore = useCallback(() => {
    if (statusFilter !== 'completed' || !hasMore || loadingMore) {
      return;
    }
    setLoadingMore(true);
    service
      .list({
        status: 'completed',
        priority: priorityFilter ?? undefined,
        search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
        limit: COMPLETED_PAGE_SIZE,
        offset: completed.length,
      })
      .then((page) => {
        setCompleted((current) => [...current, ...page]);
        setHasMore(page.length === COMPLETED_PAGE_SIZE);
      })
      .catch((loadError: unknown) => setNotice(translateError(loadError, t)))
      .finally(() => setLoadingMore(false));
  }, [statusFilter, hasMore, loadingMore, service, priorityFilter, debouncedSearch, completed.length, t]);

  const toggleComplete = useCallback(
    async (task: Task) => {
      try {
        await service.setCompleted(task.id, task.status !== 'completed');
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  const removeTask = useCallback(
    async (task: Task) => {
      try {
        await service.remove(task.id);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  const today = todayIsoDate();

  const sections = useMemo(
    () =>
      statusFilter === 'active'
        ? buildActiveSections(pending, recentCompleted, today)
        : buildCompletedSection(completed),
    [statusFilter, pending, recentCompleted, completed, today],
  );

  const overdueCount = useMemo(
    () => pending.filter((task) => task.dueAt !== null && task.dueAt < today).length,
    [pending, today],
  );

  return {
    sections,
    activeCount: pending.length,
    overdueCount,
    today,
    loading,
    refreshing,
    loadingMore,
    error,
    notice,
    clearNotice: () => setNotice(null),
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    search,
    setSearch,
    hasMore,
    refresh,
    loadMore,
    toggleComplete,
    removeTask,
  };
}
