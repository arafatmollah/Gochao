import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteAccountRepository } from '@/db/repositories/account-repository';
import { SqliteBudgetRepository } from '@/db/repositories/budget-repository';
import { SqliteTransactionRepository } from '@/db/repositories/transaction-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import type {
  AccountWithBalance,
  BudgetWithUsage,
  CategoryTotal,
  FinanceTotals,
  MonthNetItem,
} from '@/types/finance';
import {
  addDaysIsoDate,
  addMonthsToKey,
  monthBoundsForKey,
  monthKeyOf,
  todayIsoDate,
  yearBoundsOf,
} from '@/utils/dates';

export const REPORT_RANGES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

/** Months shown in the net-savings series (current + 5 previous). */
export const SAVINGS_MONTHS = 6;

export interface UseFinanceReportsResult {
  range: ReportRange;
  setRange: (range: ReportRange) => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;

  /** Selected-range income/expense/net; transfers are structurally excluded. */
  totals: FinanceTotals;
  /** Expense totals per category in the range, largest first. */
  expenseByCategory: CategoryTotal[];
  /** Current derived balances of all accounts. */
  accountBalances: AccountWithBalance[];
  /** Six-month savings series, oldest first, zero-filled for quiet months. */
  savingsSeries: MonthNetItem[];
  /** Budgets for the current month with derived spending. */
  budgetUsage: BudgetWithUsage[];
  /** False only when there is no account, budget, or in-range transaction. */
  hasData: boolean;
}

function rangeBounds(range: ReportRange, today: string): { fromOn: string; toOn: string } {
  if (range === 'daily') {
    return { fromOn: today, toOn: today };
  }
  if (range === 'weekly') {
    return { fromOn: addDaysIsoDate(today, -6), toOn: today };
  }
  if (range === 'monthly') {
    const bounds = monthBoundsForKey(monthKeyOf(today));
    return { fromOn: bounds.startOn, toOn: bounds.lastOn };
  }
  const bounds = yearBoundsOf(today);
  return { fromOn: bounds.startOn, toOn: addDaysIsoDate(bounds.nextStartOn, -1) };
}

/** Aggregated report data for the selected period, reloaded on focus. */
export function useFinanceReports(): UseFinanceReportsResult {
  const db = useSQLiteContext();
  const transactions = useMemo(
    () => new SqliteTransactionRepository(toSqlDatabase(db)),
    [db],
  );
  const accounts = useMemo(() => new SqliteAccountRepository(toSqlDatabase(db)), [db]);
  const budgets = useMemo(() => new SqliteBudgetRepository(toSqlDatabase(db)), [db]);
  const { t } = useTranslation();

  const [range, setRange] = useState<ReportRange>('monthly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totals, setTotals] = useState<FinanceTotals>({
    incomeMinor: 0,
    expenseMinor: 0,
    netMinor: 0,
  });
  const [expenseByCategory, setExpenseByCategory] = useState<CategoryTotal[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountWithBalance[]>([]);
  const [savingsSeries, setSavingsSeries] = useState<MonthNetItem[]>([]);
  const [budgetUsage, setBudgetUsage] = useState<BudgetWithUsage[]>([]);

  const load = useCallback(async () => {
    try {
      const today = todayIsoDate();
      const { fromOn, toOn } = rangeBounds(range, today);
      const currentMonth = monthBoundsForKey(monthKeyOf(today));
      const firstSavingsKey = addMonthsToKey(monthKeyOf(today), -(SAVINGS_MONTHS - 1));

      const [sums, categoryTotals, accountsWithBalances, budgetList, monthList] =
        await Promise.all([
          transactions.sumActivity({ fromOn, toOn }),
          transactions.sumByCategory({ kind: 'expense', fromOn, toOn }),
          accounts.listWithBalances({ includeArchived: true }),
          budgets.listWithUsage({
            startOn: currentMonth.startOn,
            nextStartOn: currentMonth.nextStartOn,
          }),
          transactions.monthTotals({
            fromOn: monthBoundsForKey(firstSavingsKey).startOn,
            nextStartOn: currentMonth.nextStartOn,
          }),
        ]);

      const totalsByMonth = new Map(monthList.map((item) => [item.monthKey, item]));
      const series: MonthNetItem[] = [];
      for (let index = 0; index < SAVINGS_MONTHS; index += 1) {
        const key = addMonthsToKey(firstSavingsKey, index);
        series.push(
          totalsByMonth.get(key) ?? {
            monthKey: key,
            incomeMinor: 0,
            expenseMinor: 0,
            netMinor: 0,
          },
        );
      }

      setTotals({
        incomeMinor: sums.incomeMinor,
        expenseMinor: sums.expenseMinor,
        netMinor: sums.incomeMinor - sums.expenseMinor,
      });
      setExpenseByCategory(categoryTotals);
      setAccountBalances(accountsWithBalances);
      setSavingsSeries(series);
      setBudgetUsage(budgetList);
      setError(null);
    } catch (loadError) {
      setError(translateError(loadError, t));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [transactions, accounts, budgets, range, t]);

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

  const hasData =
    totals.incomeMinor > 0 ||
    totals.expenseMinor > 0 ||
    accountBalances.length > 0 ||
    budgetUsage.length > 0;

  return {
    range,
    setRange,
    loading,
    refreshing,
    error,
    refresh,
    totals,
    expenseByCategory,
    accountBalances,
    savingsSeries,
    budgetUsage,
    hasData,
  };
}
