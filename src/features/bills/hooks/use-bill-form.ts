import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteBillRepository } from '@/db/repositories/bill-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createBillService } from '@/services/bill-service';
import {
  validateBillAmount,
  validateBillCategory,
  validateBillDueDate,
  validateBillInstallmentCount,
  validateBillName,
  validateBillNotes,
  validateBillRecurrence,
  validateBillReminderDays,
} from '@/services/bill-validation';
import type { BillCategory, BillRecurrence } from '@/types/bill';
import { todayIsoDate } from '@/utils/dates';
import { minorToInputText, normalizeDigitInput, parseAmountToMinor } from '@/utils/money';

export interface UseBillFormResult {
  isEdit: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;

  name: string;
  setName: (value: string) => void;
  /** Validation code (see `bill-validation`); translate before rendering. */
  nameError: string | null;
  amountText: string;
  setAmountText: (value: string) => void;
  /** Validation code (see `bill-validation`); translate before rendering. */
  amountError: string | null;
  category: BillCategory;
  setCategory: (value: BillCategory) => void;
  recurrence: BillRecurrence;
  setRecurrence: (value: BillRecurrence) => void;
  firstDueOn: string;
  setFirstDueOn: (value: string) => void;
  /** Validation code (see `bill-validation`); translate before rendering. */
  firstDueError: string | null;
  installmentText: string;
  setInstallmentText: (value: string) => void;
  /** Validation code (see `bill-validation`); translate before rendering. */
  installmentError: string | null;
  reminderText: string;
  setReminderText: (value: string) => void;
  /** Validation code (see `bill-validation`); translate before rendering. */
  reminderError: string | null;
  notes: string;
  setNotes: (value: string) => void;
  /** Validation code (see `bill-validation`); translate before rendering. */
  notesError: string | null;

  formError: string | null;
  saving: boolean;
  deleting: boolean;
  submit: () => Promise<boolean>;
  remove: () => Promise<boolean>;
}

interface ParsedForm {
  name: string;
  amountMinor: number;
  category: BillCategory;
  recurrence: BillRecurrence;
  firstDueOn: string;
  installmentCount: number | null;
  reminderDaysBefore: number | null;
  notes: string | null;
}

/** Parses an optional whole-number field (Bangla digits accepted). */
function parseOptionalInteger(value: string): { value: number | null; invalid: boolean } {
  const normalized = normalizeDigitInput(value).trim();
  if (normalized.length === 0) {
    return { value: null, invalid: false };
  }
  if (!/^\d{1,4}$/.test(normalized)) {
    return { value: null, invalid: true };
  }
  return { value: Number(normalized), invalid: false };
}

export function useBillForm(billId?: string): UseBillFormResult {
  const db = useSQLiteContext();
  const service = useMemo(() => createBillService(new SqliteBillRepository(toSqlDatabase(db))), [db]);
  const { t } = useTranslation();
  const isEdit = billId !== undefined;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<BillCategory>('other');
  const [recurrence, setRecurrence] = useState<BillRecurrence>('monthly');
  const [firstDueOn, setFirstDueOn] = useState(() => todayIsoDate());
  const [installmentText, setInstallmentText] = useState('');
  const [reminderText, setReminderText] = useState('');
  const [notes, setNotes] = useState('');

  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [firstDueError, setFirstDueError] = useState<string | null>(null);
  const [installmentError, setInstallmentError] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEdit || !billId) {
      return;
    }
    let active = true;
    service
      .getById(billId)
      .then((bill) => {
        if (!active) return;
        setName(bill.name);
        setAmountText(minorToInputText(bill.expectedAmountMinor));
        setCategory(bill.category);
        setRecurrence(bill.recurrence);
        setFirstDueOn(bill.firstDueOn);
        setInstallmentText(bill.installmentCount === null ? '' : String(bill.installmentCount));
        setReminderText(bill.reminderDaysBefore === null ? '' : String(bill.reminderDaysBefore));
        setNotes(bill.notes ?? '');
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
  }, [isEdit, billId, service, reloadKey, t]);

  const validate = useCallback((): ParsedForm | null => {
    const trimmedName = name.trim();
    const nameValidation = validateBillName(trimmedName);
    const amountMinor = parseAmountToMinor(amountText);
    const amountValidation =
      amountMinor === null ? 'bill_amount_invalid' : validateBillAmount(amountMinor);
    const categoryValidation = validateBillCategory(category);
    const recurrenceValidation = validateBillRecurrence(recurrence);
    const dueValidation = validateBillDueDate(firstDueOn);

    const installments = parseOptionalInteger(installmentText);
    const installmentValidation = installments.invalid
      ? 'bill_installments_invalid'
      : validateBillInstallmentCount(installments.value, recurrence);

    const reminder = parseOptionalInteger(reminderText);
    const reminderValidation = reminder.invalid
      ? 'bill_reminder_invalid'
      : validateBillReminderDays(reminder.value);

    const trimmedNotes = notes.trim();
    const notesValidation = validateBillNotes(trimmedNotes);

    setNameError(nameValidation);
    setAmountError(amountValidation);
    setFirstDueError(dueValidation);
    setInstallmentError(installmentValidation);
    setReminderError(reminderValidation);
    setNotesError(notesValidation);

    const valid =
      nameValidation === null &&
      amountValidation === null &&
      categoryValidation === null &&
      recurrenceValidation === null &&
      dueValidation === null &&
      installmentValidation === null &&
      reminderValidation === null &&
      notesValidation === null;

    if (!valid || amountMinor === null) {
      return null;
    }
    return {
      name: trimmedName,
      amountMinor,
      category,
      recurrence,
      firstDueOn,
      installmentCount: installments.value,
      reminderDaysBefore: reminder.value,
      notes: trimmedNotes.length > 0 ? trimmedNotes : null,
    };
  }, [name, amountText, category, recurrence, firstDueOn, installmentText, reminderText, notes]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (saving || deleting) {
      return false;
    }
    setFormError(null);
    const parsed = validate();
    if (!parsed) {
      return false;
    }
    setSaving(true);
    try {
      if (isEdit && billId) {
        await service.update(billId, {
          name: parsed.name,
          category: parsed.category,
          expectedAmountMinor: parsed.amountMinor,
          reminderDaysBefore: parsed.reminderDaysBefore,
          notes: parsed.notes,
        });
      } else {
        await service.create({
          name: parsed.name,
          category: parsed.category,
          expectedAmountMinor: parsed.amountMinor,
          recurrence: parsed.recurrence,
          firstDueOn: parsed.firstDueOn,
          installmentCount: parsed.installmentCount,
          reminderDaysBefore: parsed.reminderDaysBefore,
          notes: parsed.notes,
        });
      }
      return true;
    } catch (submitError) {
      setFormError(translateError(submitError, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, deleting, validate, isEdit, billId, service, t]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !billId || saving || deleting) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await service.remove(billId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, billId, saving, deleting, service, t]);

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
    amountText,
    setAmountText: (value) => {
      setAmountText(value);
      if (amountError) setAmountError(null);
    },
    amountError,
    category,
    setCategory,
    recurrence,
    setRecurrence,
    firstDueOn,
    setFirstDueOn: (value) => {
      setFirstDueOn(value);
      if (firstDueError) setFirstDueError(null);
    },
    firstDueError,
    installmentText,
    setInstallmentText: (value) => {
      setInstallmentText(value);
      if (installmentError) setInstallmentError(null);
    },
    installmentError,
    reminderText,
    setReminderText: (value) => {
      setReminderText(value);
      if (reminderError) setReminderError(null);
    },
    reminderError,
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
