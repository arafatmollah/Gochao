import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteAccountRepository } from '@/db/repositories/account-repository';
import { SqliteBillRepository } from '@/db/repositories/bill-repository';
import { SqliteCategoryRepository } from '@/db/repositories/category-repository';
import { SqliteTaskRepository } from '@/db/repositories/task-repository';
import { SqliteTransactionRepository } from '@/db/repositories/transaction-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createAccountService } from '@/services/account-service';
import { createBillService } from '@/services/bill-service';
import { createTaskService } from '@/services/task-service';
import { createTransactionService } from '@/services/transaction-service';
import type { BillDueItem } from '@/types/bill';
import type { Task } from '@/types/task';
import {
  localDayBoundsIso,
  monthBoundsForKey,
  monthKeyOf,
  todayIsoDate,
} from '@/utils/dates';

import {
  buildDashboardFinance,
  EMPTY_DASHBOARD_FINANCE,
  type DashboardFinance,
} from '../finance-summary';
import { buildDashboardSummary, type DashboardSummary } from '../summary';

/** Upper bound for the rows rendered on the dashboard. */
const DASHBOARD_TASK_LIMIT = 50;
/** The dashboard previews only the nearest few upcoming bills. */
const DASHBOARD_BILL_LIMIT = 5;

export interface UseDashboardResult {
  summary: DashboardSummary;
  /** Money figures for the finance card, all derived from stored records. */
  finance: DashboardFinance;
  /** Pending tasks due today or overdue, ordered by the repository. */
  tasks: Task[];
  /** Nearest pending bill occurrences; the full list lives on the Bills tab. */
  upcomingBills: BillDueItem[];
  today: string;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  notice: string | null;
  clearNotice: () => void;
  refresh: () => void;
  toggleComplete: (task: Task) => Promise<void>;
}

const EMPTY_SUMMARY = buildDashboardSummary({
  pendingDueCount: 0,
  overdueCount: 0,
  dueTodayCount: 0,
  completedTodayCount: 0,
});

export function useDashboard(): UseDashboardResult {
  const db = useSQLiteContext();
  const service = useMemo(() => createTaskService(new SqliteTaskRepository(toSqlDatabase(db))), [db]);
  const billService = useMemo(
    () => createBillService(new SqliteBillRepository(toSqlDatabase(db))),
    [db],
  );
  const transactionService = useMemo(
    () =>
      createTransactionService(new SqliteTransactionRepository(toSqlDatabase(db)), {
        accounts: new SqliteAccountRepository(toSqlDatabase(db)),
        categories: new SqliteCategoryRepository(toSqlDatabase(db)),
      }),
    [db],
  );
  const accountService = useMemo(
    () => createAccountService(new SqliteAccountRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();

  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [finance, setFinance] = useState<DashboardFinance>(EMPTY_DASHBOARD_FINANCE);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<BillDueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const currentToday = todayIsoDate();
    const { startIso, endIso } = localDayBoundsIso();
    const month = monthBoundsForKey(monthKeyOf(currentToday));

    try {
      // Materializing ahead first keeps the upcoming-bills preview accurate
      // on a fresh install; it is idempotent, so the extra call is cheap.
      await billService.ensureOccurrencesAhead();
      const [
        todaysTasks,
        pendingDueCount,
        overdueCount,
        completedTodayCount,
        bills,
        todayTotals,
        monthTotals,
        accountsWithBalances,
      ] = await Promise.all([
        service.list({
          status: 'pending',
          dueOnOrBefore: currentToday,
          limit: DASHBOARD_TASK_LIMIT,
        }),
        service.count({ status: 'pending', dueOnOrBefore: currentToday }),
        service.count({ status: 'pending', dueBefore: currentToday }),
        service.countCompletedBetween(startIso, endIso),
        billService.listDue({ limit: DASHBOARD_BILL_LIMIT }),
        transactionService.sumActivity({ fromOn: currentToday, toOn: currentToday }),
        transactionService.sumActivity({ fromOn: month.startOn, toOn: month.lastOn }),
        accountService.listWithBalances(),
      ]);
      if (requestIdRef.current !== requestId) return;
      setTasks(todaysTasks);
      setUpcomingBills(bills);
      setSummary(
        buildDashboardSummary({
          pendingDueCount,
          overdueCount,
          dueTodayCount: Math.max(pendingDueCount - overdueCount, 0),
          completedTodayCount,
        }),
      );
      // Transfers are structurally absent from `sumActivity`, so the month's
      // income/expense totals never include them (rule 11).
      setFinance(
        buildDashboardFinance({
          todayExpenseMinor: todayTotals.expenseMinor,
          monthIncomeMinor: monthTotals.incomeMinor,
          monthExpenseMinor: monthTotals.expenseMinor,
          accountBalances: accountsWithBalances.map((account) => account.balanceMinor),
        }),
      );
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
  }, [service, billService, transactionService, accountService, t]);

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

  return {
    summary,
    finance,
    tasks,
    upcomingBills,
    today: todayIsoDate(),
    loading,
    refreshing,
    error,
    notice,
    clearNotice: () => setNotice(null),
    refresh,
    toggleComplete,
  };
}
