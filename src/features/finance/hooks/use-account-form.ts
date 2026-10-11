import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteAccountRepository } from '@/db/repositories/account-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createAccountService } from '@/services/account-service';
import { amountError, validateAccountName, validateAccountType } from '@/services/finance-validation';
import type { AccountType } from '@/types/finance';
import { minorToInputText, parseAmountToMinor } from '@/utils/money';

export interface UseAccountFormResult {
  isEdit: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;

  name: string;
  setName: (value: string) => void;
  /** Validation code (see `finance-validation`); translate before rendering. */
  nameError: string | null;
  type: AccountType;
  setType: (value: AccountType) => void;
  openingText: string;
  setOpeningText: (value: string) => void;
  /** Validation code (see `finance-validation`); translate before rendering. */
  openingError: string | null;

  isArchived: boolean;
  formError: string | null;
  saving: boolean;
  archiving: boolean;
  deleting: boolean;
  submit: () => Promise<boolean>;
  toggleArchive: () => Promise<boolean>;
  remove: () => Promise<boolean>;
}

export function useAccountForm(accountId?: string): UseAccountFormResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createAccountService(new SqliteAccountRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();
  const isEdit = accountId !== undefined;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [openingText, setOpeningText] = useState('');
  const [isArchived, setIsArchived] = useState(false);

  const [nameError, setNameError] = useState<string | null>(null);
  const [openingError, setOpeningError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEdit || !accountId) {
      return;
    }
    let active = true;
    service
      .getById(accountId)
      .then((account) => {
        if (!active) return;
        setName(account.name);
        setType(account.type);
        setOpeningText(minorToInputText(account.openingBalanceMinor));
        setIsArchived(account.isArchived);
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
  }, [isEdit, accountId, service, reloadKey, t]);

  /** Empty text means zero opening balance. */
  const parseOpening = useCallback((): number | null => {
    if (openingText.trim().length === 0) {
      return 0;
    }
    return parseAmountToMinor(openingText);
  }, [openingText]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (saving || archiving || deleting) {
      return false;
    }
    setFormError(null);
    const trimmedName = name.trim();
    const nameValidation = validateAccountName(trimmedName);
    const typeValidation = validateAccountType(type);
    const opening = parseOpening();
    const openingValidation =
      opening === null
        ? 'account_opening_balance_invalid'
        : amountError(opening, 'account_opening_balance_invalid', { allowZero: true });
    setNameError(nameValidation);
    setOpeningError(openingValidation);
    if (nameValidation !== null || typeValidation !== null || openingValidation !== null || opening === null) {
      return false;
    }

    setSaving(true);
    try {
      if (isEdit && accountId) {
        await service.update(accountId, { name: trimmedName, type, openingBalanceMinor: opening });
      } else {
        await service.create({ name: trimmedName, type, openingBalanceMinor: opening });
      }
      return true;
    } catch (submitError) {
      setFormError(translateError(submitError, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, archiving, deleting, name, type, parseOpening, isEdit, accountId, service, t]);

  const toggleArchive = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !accountId || saving || archiving || deleting) {
      return false;
    }
    setFormError(null);
    setArchiving(true);
    try {
      await service.setArchived(accountId, !isArchived);
      return true;
    } catch (archiveError) {
      setFormError(translateError(archiveError, t));
      return false;
    } finally {
      setArchiving(false);
    }
  }, [isEdit, accountId, saving, archiving, deleting, isArchived, service, t]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !accountId || saving || archiving || deleting) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await service.remove(accountId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, accountId, saving, archiving, deleting, service, t]);

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
    name,
    setName: (value) => {
      setName(value);
      if (nameError) setNameError(null);
    },
    nameError,
    type,
    setType,
    openingText,
    setOpeningText: (value) => {
      setOpeningText(value);
      if (openingError) setOpeningError(null);
    },
    openingError,
    isArchived,
    formError,
    saving,
    archiving,
    deleting,
    submit,
    toggleArchive,
    remove,
  };
}
