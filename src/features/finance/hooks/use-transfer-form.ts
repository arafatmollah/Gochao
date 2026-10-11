import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteAccountRepository } from '@/db/repositories/account-repository';
import { SqliteTransferRepository } from '@/db/repositories/transfer-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createAccountService } from '@/services/account-service';
import { createTransferService } from '@/services/transfer-service';
import { validateOccurredOn, validateTransferAccounts, validateTransferNotes } from '@/services/finance-validation';
import type { Account } from '@/types/finance';
import { todayIsoDate } from '@/utils/dates';
import { minorToInputText, parseAmountToMinor } from '@/utils/money';

export interface UseTransferFormResult {
  isEdit: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;

  accounts: Account[];
  fromAccountId: string | null;
  setFromAccountId: (value: string) => void;
  toAccountId: string | null;
  setToAccountId: (value: string) => void;
  /** Validation code (see `finance-validation`); translate before rendering. */
  accountsError: string | null;
  amountText: string;
  setAmountText: (value: string) => void;
  /** Validation code (see `finance-validation`); translate before rendering. */
  amountError: string | null;
  occurredOn: string;
  setOccurredOn: (value: string) => void;
  /** Validation code (see `finance-validation`); translate before rendering. */
  occurredOnError: string | null;
  notes: string;
  setNotes: (value: string) => void;
  /** Validation code (see `finance-validation`); translate before rendering. */
  notesError: string | null;

  formError: string | null;
  saving: boolean;
  deleting: boolean;
  submit: () => Promise<boolean>;
  remove: () => Promise<boolean>;
}

export function useTransferForm(transferId?: string): UseTransferFormResult {
  const db = useSQLiteContext();
  const services = useMemo(() => {
    const sql = toSqlDatabase(db);
    return {
      accounts: createAccountService(new SqliteAccountRepository(sql)),
      transfers: createTransferService(new SqliteTransferRepository(sql), {
        accounts: new SqliteAccountRepository(sql),
      }),
    };
  }, [db]);
  const { t } = useTranslation();
  const isEdit = transferId !== undefined;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [occurredOn, setOccurredOn] = useState(() => todayIsoDate());
  const [notes, setNotes] = useState('');

  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [occurredOnError, setOccurredOnError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadForNew(): Promise<void> {
      const accountList = await services.accounts.list();
      if (!active) return;
      setAccounts(accountList);
      setFromAccountId(accountList[0]?.id ?? null);
      setToAccountId(accountList[1]?.id ?? null);
      setLoadError(null);
      setLoadState('ready');
    }

    async function loadForEdit(): Promise<void> {
      const transfer = await services.transfers.getById(transferId as string);
      const accountList = await services.accounts.list();
      // A transfer linked to an archived account keeps showing that account.
      for (const id of [transfer.fromAccountId, transfer.toAccountId]) {
        if (!accountList.some((account) => account.id === id)) {
          accountList.push(await services.accounts.getById(id));
        }
      }
      if (!active) return;
      setAccounts(accountList);
      setFromAccountId(transfer.fromAccountId);
      setToAccountId(transfer.toAccountId);
      setAmountText(minorToInputText(transfer.amountMinor));
      setOccurredOn(transfer.occurredOn);
      setNotes(transfer.notes ?? '');
      setLoadError(null);
      setLoadState('ready');
    }

    const task = isEdit && transferId ? loadForEdit : () => loadForNew();
    task().catch((loadFailure: unknown) => {
      if (!active) return;
      setLoadError(translateError(loadFailure, t));
      setLoadState('error');
    });
    return () => {
      active = false;
    };
  }, [isEdit, transferId, services, reloadKey, t]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (saving || deleting) {
      return false;
    }
    setFormError(null);

    const amountMinor = parseAmountToMinor(amountText);
    const amountValidation = amountMinor === null ? 'transfer_amount_invalid' : null;
    const accountsValidation =
      fromAccountId === null || toAccountId === null
        ? 'account_unavailable'
        : validateTransferAccounts(fromAccountId, toAccountId);
    const dateValidation = validateOccurredOn(occurredOn, 'transfer_date_invalid');
    const trimmedNotes = notes.trim();
    const notesValidation = validateTransferNotes(trimmedNotes);

    setAmountError(amountValidation);
    setAccountsError(accountsValidation);
    setOccurredOnError(dateValidation);
    setNotesError(notesValidation);

    if (
      amountValidation !== null ||
      accountsValidation !== null ||
      dateValidation !== null ||
      notesValidation !== null ||
      amountMinor === null ||
      fromAccountId === null ||
      toAccountId === null
    ) {
      return false;
    }

    setSaving(true);
    try {
      const payload = {
        fromAccountId,
        toAccountId,
        amountMinor,
        occurredOn,
        notes: trimmedNotes.length > 0 ? trimmedNotes : null,
      };
      if (isEdit && transferId) {
        await services.transfers.update(transferId, payload);
      } else {
        await services.transfers.create(payload);
      }
      return true;
    } catch (submitError) {
      setFormError(translateError(submitError, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    deleting,
    amountText,
    fromAccountId,
    toAccountId,
    occurredOn,
    notes,
    isEdit,
    transferId,
    services,
    t,
  ]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !transferId || saving || deleting) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await services.transfers.remove(transferId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, transferId, saving, deleting, services, t]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoadState('loading');
    setReloadKey((key) => key + 1);
  }, []);

  return {
    isEdit,
    loadState,
    loadError,
    retryLoad,
    accounts,
    fromAccountId,
    setFromAccountId: (value) => {
      setFromAccountId(value);
      if (accountsError) setAccountsError(null);
    },
    toAccountId,
    setToAccountId: (value) => {
      setToAccountId(value);
      if (accountsError) setAccountsError(null);
    },
    accountsError,
    amountText,
    setAmountText: (value) => {
      setAmountText(value);
      if (amountError) setAmountError(null);
    },
    amountError,
    occurredOn,
    setOccurredOn: (value) => {
      setOccurredOn(value);
      if (occurredOnError) setOccurredOnError(null);
    },
    occurredOnError,
    notes,
    setNotes: (value) => {
      setNotes(value);
      if (notesError) setNotesError(null);
    },
    notesError,
    formError,
    saving,
    deleting,
    submit,
    remove,
  };
}
