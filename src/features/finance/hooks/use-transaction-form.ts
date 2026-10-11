import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteAccountRepository } from '@/db/repositories/account-repository';
import { SqliteCategoryRepository } from '@/db/repositories/category-repository';
import { SqliteTransactionRepository } from '@/db/repositories/transaction-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createAccountService } from '@/services/account-service';
import { createCategoryService } from '@/services/category-service';
import { createTransactionService } from '@/services/transaction-service';
import {
  validateOccurredOn,
  validateRecipient,
  validateTransactionDescription,
  validateTransactionNotes,
} from '@/services/finance-validation';
import type { Account, Category, TransactionKind } from '@/types/finance';
import { todayIsoDate } from '@/utils/dates';
import { minorToInputText, parseAmountToMinor } from '@/utils/money';

export interface UseTransactionFormResult {
  isEdit: boolean;
  kind: TransactionKind;
  /** Bill-linked expenses are managed from the bill screen, never edited here. */
  lockedByBill: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;

  accounts: Account[];
  categories: Category[];

  amountText: string;
  setAmountText: (value: string) => void;
  /** Validation code (see `finance-validation`); translate before rendering. */
  amountError: string | null;
  accountId: string | null;
  setAccountId: (value: string) => void;
  /** Validation code (see `finance-validation`); translate before rendering. */
  accountError: string | null;
  categoryId: string | null;
  setCategoryId: (value: string) => void;
  /** Validation code (see `finance-validation`); translate before rendering. */
  categoryError: string | null;
  occurredOn: string;
  setOccurredOn: (value: string) => void;
  /** Validation code (see `finance-validation`); translate before rendering. */
  occurredOnError: string | null;
  description: string;
  setDescription: (value: string) => void;
  /** Validation code (see `finance-validation`); translate before rendering. */
  descriptionError: string | null;
  recipient: string;
  setRecipient: (value: string) => void;
  /** Validation code (see `finance-validation`); translate before rendering. */
  recipientError: string | null;
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

export function useTransactionForm(
  transactionId: string | undefined,
  kindParam: TransactionKind,
): UseTransactionFormResult {
  const db = useSQLiteContext();
  const services = useMemo(() => {
    const sql = toSqlDatabase(db);
    const accountRepo = new SqliteAccountRepository(sql);
    const categoryRepo = new SqliteCategoryRepository(sql);
    return {
      accounts: createAccountService(accountRepo),
      categories: createCategoryService(categoryRepo),
      transactions: createTransactionService(new SqliteTransactionRepository(sql), {
        accounts: accountRepo,
        categories: categoryRepo,
      }),
    };
  }, [db]);
  const { t } = useTranslation();
  const isEdit = transactionId !== undefined;

  const [kind, setKind] = useState<TransactionKind>(kindParam);
  const [lockedByBill, setLockedByBill] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [amountText, setAmountText] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [occurredOn, setOccurredOn] = useState(() => todayIsoDate());
  const [description, setDescription] = useState('');
  const [recipient, setRecipient] = useState('');
  const [notes, setNotes] = useState('');

  const [amountError, setAmountError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [occurredOnError, setOccurredOnError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadForNew(): Promise<void> {
      const [accountList, categoryList] = await Promise.all([
        services.accounts.list(),
        services.categories.list({ kind: kindParam }),
      ]);
      if (!active) return;
      setKind(kindParam);
      setAccounts(accountList);
      setCategories(categoryList);
      setAccountId(accountList[0]?.id ?? null);
      setCategoryId(categoryList[0]?.id ?? null);
      setLoadError(null);
      setLoadState('ready');
    }

    async function loadForEdit(): Promise<void> {
      const transaction = await services.transactions.getById(transactionId as string);
      const [accountList, categoryList] = await Promise.all([
        services.accounts.list(),
        services.categories.list({ kind: transaction.kind }),
      ]);
      // Editing a record that sits on an archived account/category stays
      // allowed, so the record's own (archived) entries are added back.
      if (!accountList.some((account) => account.id === transaction.accountId)) {
        accountList.push(await services.accounts.getById(transaction.accountId));
      }
      if (!categoryList.some((category) => category.id === transaction.categoryId)) {
        categoryList.push(await services.categories.getById(transaction.categoryId));
      }
      if (!active) return;
      setKind(transaction.kind);
      setLockedByBill(transaction.billOccurrenceId !== null);
      setAccounts(accountList);
      setCategories(categoryList);
      setAmountText(minorToInputText(transaction.amountMinor));
      setAccountId(transaction.accountId);
      setCategoryId(transaction.categoryId);
      setOccurredOn(transaction.occurredOn);
      setDescription(transaction.description);
      setRecipient(transaction.recipient ?? '');
      setNotes(transaction.notes ?? '');
      setLoadError(null);
      setLoadState('ready');
    }

    const task = isEdit && transactionId ? loadForEdit : () => loadForNew();
    task().catch((loadFailure: unknown) => {
      if (!active) return;
      setLoadError(translateError(loadFailure, t));
      setLoadState('error');
    });
    return () => {
      active = false;
    };
  }, [isEdit, transactionId, kindParam, services, reloadKey, t]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (saving || deleting || lockedByBill) {
      return false;
    }
    setFormError(null);

    const amountMinor = parseAmountToMinor(amountText);
    const amountValidation = amountMinor === null ? 'transaction_amount_invalid' : null;
    const dateValidation = validateOccurredOn(occurredOn, 'transaction_date_invalid');
    const trimmedDescription = description.trim();
    const descriptionValidation = validateTransactionDescription(trimmedDescription);
    const recipientValidation = kind === 'expense' ? validateRecipient(recipient) : null;
    const trimmedNotes = notes.trim();
    const notesValidation = validateTransactionNotes(trimmedNotes);

    setAmountError(amountValidation);
    setOccurredOnError(dateValidation);
    setDescriptionError(descriptionValidation);
    setRecipientError(recipientValidation);
    setNotesError(notesValidation);

    const accountValidation = accountId === null ? 'account_unavailable' : null;
    const categoryValidation = categoryId === null ? 'category_unavailable' : null;
    setAccountError(accountValidation);
    setCategoryError(categoryValidation);

    if (
      amountValidation !== null ||
      dateValidation !== null ||
      descriptionValidation !== null ||
      recipientValidation !== null ||
      notesValidation !== null ||
      accountValidation !== null ||
      categoryValidation !== null ||
      amountMinor === null ||
      accountId === null ||
      categoryId === null
    ) {
      return false;
    }

    setSaving(true);
    try {
      const payload = {
        amountMinor,
        accountId,
        categoryId,
        occurredOn,
        description: trimmedDescription,
        recipient: kind === 'expense' && recipient.trim().length > 0 ? recipient.trim() : null,
        notes: trimmedNotes.length > 0 ? trimmedNotes : null,
      };
      if (isEdit && transactionId) {
        await services.transactions.update(transactionId, payload);
      } else {
        await services.transactions.create({ kind, ...payload });
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
    lockedByBill,
    amountText,
    occurredOn,
    description,
    kind,
    recipient,
    notes,
    accountId,
    categoryId,
    isEdit,
    transactionId,
    services,
    t,
  ]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !transactionId || saving || deleting || lockedByBill) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await services.transactions.remove(transactionId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, transactionId, saving, deleting, lockedByBill, services, t]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoadState('loading');
    setReloadKey((key) => key + 1);
  }, []);

  return {
    isEdit,
    kind,
    lockedByBill,
    loadState,
    loadError,
    retryLoad,
    accounts,
    categories,
    amountText,
    setAmountText: (value) => {
      setAmountText(value);
      if (amountError) setAmountError(null);
    },
    amountError,
    accountId,
    setAccountId: (value) => {
      setAccountId(value);
      if (accountError) setAccountError(null);
    },
    accountError,
    categoryId,
    setCategoryId: (value) => {
      setCategoryId(value);
      if (categoryError) setCategoryError(null);
    },
    categoryError,
    occurredOn,
    setOccurredOn: (value) => {
      setOccurredOn(value);
      if (occurredOnError) setOccurredOnError(null);
    },
    occurredOnError,
    description,
    setDescription: (value) => {
      setDescription(value);
      if (descriptionError) setDescriptionError(null);
    },
    descriptionError,
    recipient,
    setRecipient: (value) => {
      setRecipient(value);
      if (recipientError) setRecipientError(null);
    },
    recipientError,
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
