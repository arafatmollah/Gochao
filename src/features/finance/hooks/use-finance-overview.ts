import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteAccountRepository } from '@/db/repositories/account-repository';
import { SqliteCategoryRepository } from '@/db/repositories/category-repository';
import { SqliteTransactionRepository } from '@/db/repositories/transaction-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createAccountService } from '@/services/account-service';
import { createTransactionService } from '@/services/transaction-service';
import type { AccountWithBalance, ActivityRow, FinanceTotals } from '@/types/finance';
import { monthBoundsForKey, monthKeyOf, todayIsoDate } from '@/utils/dates';

const RECENT_LIMIT = 8;

export interface UseFinanceOverviewResult {
  accounts: AccountWithBalance[];
  totalBalanceMinor: number;
  /** Income/expense/net for the current calendar month. */
  monthTotals: FinanceTotals;
  recent: ActivityRow[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

/** Summary data for the Finance tab: balances, month totals, recent activity. */
export function useFinanceOverview(): UseFinanceOverviewResult {
  const db = useSQLiteContext();
  const services = useMemo(() => {
    const sql = toSqlDatabase(db);
    return {
      accounts: createAccountService(new SqliteAccountRepository(sql)),
      transactions: createTransactionService(new SqliteTransactionRepository(sql), {
        accounts: new SqliteAccountRepository(sql),
        categories: new SqliteCategoryRepository(sql),
      }),
    };
  }, [db]);
  const { t } = useTranslation();

  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [monthTotals, setMonthTotals] = useState<FinanceTotals>({
    incomeMinor: 0,
    expenseMinor: 0,
    netMinor: 0,
  });
  const [recent, setRecent] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { startOn, lastOn } = monthBoundsForKey(monthKeyOf(todayIsoDate()));
      const [accountList, totals, recentRows] = await Promise.all([
        services.accounts.listWithBalances(),
        services.transactions.sumActivity({ fromOn: startOn, toOn: lastOn }),
        services.transactions.listActivity({ limit: RECENT_LIMIT }),
      ]);
      setAccounts(accountList);
      setMonthTotals({ ...totals });
      setRecent(recentRows);
      setError(null);
    } catch (loadError) {
      setError(translateError(loadError, t));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [services, t]);

  // Reload on every focus so figures are fresh after adding income/expenses.
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

  const totalBalanceMinor = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balanceMinor, 0),
    [accounts],
  );

  return {
    accounts,
    totalBalanceMinor,
    monthTotals,
    recent,
    loading,
    refreshing,
    error,
    refresh,
  };
}
