import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteAccountRepository } from '@/db/repositories/account-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createAccountService } from '@/services/account-service';
import type { AccountWithBalance } from '@/types/finance';

export interface UseAccountsResult {
  accounts: AccountWithBalance[];
  includeArchived: boolean;
  setIncludeArchived: (value: boolean) => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

/** Accounts with derived balances, reloaded on focus and refresh. */
export function useAccounts(): UseAccountsResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createAccountService(new SqliteAccountRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();

  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (withArchived: boolean, silent: boolean) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const list = await service.listWithBalances({ includeArchived: withArchived });
        setAccounts(list);
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
        await load(includeArchived, true);
      })();
    }, [load, includeArchived]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load(includeArchived, true);
  }, [load, includeArchived]);

  const chooseArchived = useCallback((value: boolean) => {
    setIncludeArchived(value);
  }, []);

  return {
    accounts,
    includeArchived,
    setIncludeArchived: chooseArchived,
    loading,
    refreshing,
    error,
    refresh,
  };
}
