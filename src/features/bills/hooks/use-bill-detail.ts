import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteBillRepository } from '@/db/repositories/bill-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createBillPaymentService } from '@/services/bill-payment-service';
import { createBillService } from '@/services/bill-service';
import type { Bill, BillOccurrence } from '@/types/bill';

export interface UseBillDetailResult {
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;
  bill: Bill | null;
  /** All occurrences of the bill, newest due date first. */
  occurrences: BillOccurrence[];
  paidCount: number;
  pendingCount: number;
  /** True while an action (archive/delete/undo) is running. */
  busy: boolean;
  /** Action failure shown as a banner (e.g. delete blocked by payments). */
  actionError: string | null;
  clearActionError: () => void;
  setArchived: (archived: boolean) => Promise<boolean>;
  remove: () => Promise<boolean>;
  markUnpaid: (occurrenceId: string) => Promise<boolean>;
}

export function useBillDetail(billId?: string): UseBillDetailResult {
  const db = useSQLiteContext();
  const repo = useMemo(() => new SqliteBillRepository(toSqlDatabase(db)), [db]);
  const bills = useMemo(() => createBillService(repo), [repo]);
  const payments = useMemo(() => createBillPaymentService(repo), [repo]);
  const { t } = useTranslation();

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [occurrences, setOccurrences] = useState<BillOccurrence[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (): Promise<boolean> => {
    if (!billId) {
      return false;
    }
    const requestId = ++requestIdRef.current;
    try {
      const [loadedBill, loadedOccurrences] = await Promise.all([
        bills.getById(billId),
        bills.listOccurrences(billId),
      ]);
      if (requestIdRef.current !== requestId) return false;
      setBill(loadedBill);
      setOccurrences(loadedOccurrences);
      setLoadError(null);
      setLoadState('ready');
      return true;
    } catch (loadFailure) {
      if (requestIdRef.current !== requestId) return false;
      setLoadError(translateError(loadFailure, t));
      setLoadState('error');
      return false;
    }
  }, [billId, bills, t]);

  // Reloads on every focus (initial mount included) so returning from the
  // pay/edit modals shows the recorded payment. The async IIFE keeps setState
  // out of the synchronous effect body.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await load();
      })();
    }, [load]),
  );

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoadState('loading');
    void load();
  }, [load]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      if (busy) {
        return false;
      }
      setActionError(null);
      setBusy(true);
      try {
        await action();
        await load();
        return true;
      } catch (actionFailure) {
        setActionError(translateError(actionFailure, t));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, load, t],
  );

  const setArchived = useCallback(
    (archived: boolean): Promise<boolean> => {
      if (!billId) return Promise.resolve(false);
      return runAction(() => bills.setArchived(billId, archived));
    },
    [billId, bills, runAction],
  );

  const remove = useCallback((): Promise<boolean> => {
    if (!billId) return Promise.resolve(false);
    return runAction(() => bills.remove(billId));
  }, [billId, bills, runAction]);

  const markUnpaid = useCallback(
    (occurrenceId: string): Promise<boolean> =>
      runAction(() => payments.undoPayment(occurrenceId)),
    [payments, runAction],
  );

  const paidCount = useMemo(
    () => occurrences.filter((occurrence) => occurrence.status === 'paid').length,
    [occurrences],
  );

  return {
    // A missing route param is a load error; derived here so the effect never
    // needs to set state synchronously.
    loadState: billId ? loadState : 'error',
    loadError: billId ? loadError : t('errors.notFound'),
    retryLoad,
    bill,
    occurrences,
    paidCount,
    pendingCount: occurrences.length - paidCount,
    busy,
    actionError,
    clearActionError: () => setActionError(null),
    setArchived,
    remove,
    markUnpaid,
  };
}
