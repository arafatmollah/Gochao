import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteAccountRepository } from '@/db/repositories/account-repository';
import { SqliteBillRepository } from '@/db/repositories/bill-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createAccountService } from '@/services/account-service';
import { createBillPaymentService } from '@/services/bill-payment-service';
import { validatePaidAmount, validatePaidOn } from '@/services/bill-validation';
import type { BillDueItem } from '@/types/bill';
import type { Account } from '@/types/finance';
import { todayIsoDate } from '@/utils/dates';
import { minorToInputText, parseAmountToMinor } from '@/utils/money';

export interface UseBillPayResult {
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;
  occurrence: BillDueItem | null;

  amountText: string;
  setAmountText: (value: string) => void;
  /** Validation code (see `bill-validation`); translate before rendering. */
  amountError: string | null;
  paidOn: string;
  setPaidOn: (value: string) => void;
  /** Validation code (see `bill-validation`); translate before rendering. */
  paidOnError: string | null;

  /** Active accounts the payment can be filed against. */
  accounts: Account[];
  /**
   * Which account the payment leaves from. `undefined` means the user has
   * not chosen yet: the first active account (or none) is used. `null`
   * means explicitly "don't track in accounts" — no expense is filed.
   */
  accountChoice: string | null | undefined;
  setAccountChoice: (accountId: string | null) => void;
  /** The choice actually submitted; derived, so it never needs an effect. */
  accountId: string | null;

  formError: string | null;
  saving: boolean;
  submit: () => Promise<boolean>;
}

export function useBillPay(occurrenceId?: string): UseBillPayResult {
  const db = useSQLiteContext();
  const services = useMemo(() => {
    const accountRepo = new SqliteAccountRepository(toSqlDatabase(db));
    const repo = new SqliteBillRepository(toSqlDatabase(db));
    return {
      accounts: createAccountService(accountRepo),
      payments: createBillPaymentService(repo, { accounts: accountRepo }),
    };
  }, [db]);
  const { t } = useTranslation();

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [occurrence, setOccurrence] = useState<BillDueItem | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [amountText, setAmountText] = useState('');
  const [paidOn, setPaidOnState] = useState(() => todayIsoDate());
  const [amountError, setAmountError] = useState<string | null>(null);
  const [paidOnError, setPaidOnError] = useState<string | null>(null);
  const [accountChoice, setAccountChoice] = useState<string | null | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!occurrenceId) {
      return;
    }
    let active = true;
    Promise.all([services.payments.getOccurrence(occurrenceId), services.accounts.list()])
      .then(([loaded, activeAccounts]) => {
        if (!active) return;
        setOccurrence(loaded);
        setAccounts(activeAccounts);
        // Prefill with the recorded payment when there is one (re-recording
        // is idempotent and keeps the original), else the expected amount.
        setAmountText(minorToInputText(loaded.paidAmountMinor ?? loaded.expectedAmountMinor));
        if (loaded.paidOn) {
          setPaidOnState(loaded.paidOn);
        }
        setLoadError(null);
        setLoadState('ready');
      })
      .catch((loadFailure: unknown) => {
        if (!active) return;
        setLoadError(translateError(loadFailure, t));
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [occurrenceId, services, reloadKey, t]);

  // Untouched choice defaults to the first active account; when there are no
  // accounts at all the payment records without filing an expense.
  const accountId = accountChoice === undefined ? (accounts[0]?.id ?? null) : accountChoice;

  const submit = useCallback(async (): Promise<boolean> => {
    if (saving || !occurrenceId) {
      return false;
    }
    setFormError(null);
    const amountMinor = parseAmountToMinor(amountText);
    const amountValidation =
      amountMinor === null ? 'bill_paid_amount_invalid' : validatePaidAmount(amountMinor);
    const paidOnValidation = validatePaidOn(paidOn);
    setAmountError(amountValidation);
    setPaidOnError(paidOnValidation);
    if (amountValidation !== null || paidOnValidation !== null || amountMinor === null) {
      return false;
    }

    setSaving(true);
    try {
      // Idempotent: a second recording returns the first payment unchanged.
      // With an account selected, the expense is filed atomically alongside.
      await services.payments.recordPayment(occurrenceId, {
        paidAmountMinor: amountMinor,
        paidOn,
        accountId,
      });
      return true;
    } catch (submitError) {
      setFormError(translateError(submitError, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, occurrenceId, amountText, paidOn, accountId, services, t]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoadState('loading');
    setReloadKey((key) => key + 1);
  }, []);

  return {
    // A missing route param is a load error; derived here so the effect never
    // needs to set state synchronously.
    loadState: occurrenceId ? loadState : 'error',
    loadError: occurrenceId ? loadError : t('errors.notFound'),
    retryLoad,
    occurrence,
    amountText,
    setAmountText: (value) => {
      setAmountText(value);
      if (amountError) setAmountError(null);
    },
    amountError,
    paidOn,
    setPaidOn: (value) => {
      setPaidOnState(value);
      if (paidOnError) setPaidOnError(null);
    },
    paidOnError,
    accounts,
    accountChoice,
    setAccountChoice,
    accountId,
    formError,
    saving,
    submit,
  };
}
