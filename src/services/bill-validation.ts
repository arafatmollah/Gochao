import {
  BILL_CATEGORIES,
  BILL_NAME_MAX_LENGTH,
  BILL_NOTES_MAX_LENGTH,
  BILL_RECURRENCES,
  INSTALLMENT_COUNT_MAX,
  INSTALLMENT_COUNT_MIN,
  REMINDER_DAYS_MAX,
  type BillCategory,
  type BillRecurrence,
} from '@/types/bill';
import { isValidIsoDate } from '@/utils/dates';
import { MAX_AMOUNT_MINOR } from '@/utils/money';

/**
 * Shared bill validation rules, used by the form (field-level feedback) and
 * by the bill services (authoritative check before persisting). Validators
 * return a stable machine-readable code (or null when valid); the UI
 * translates codes via `translateValidationCode` and services wrap them in
 * `AppError('validation', code)`.
 */

export type BillValidationCode =
  | 'bill_name_required'
  | 'bill_name_too_long'
  | 'bill_amount_invalid'
  | 'bill_category_invalid'
  | 'bill_recurrence_invalid'
  | 'bill_due_invalid'
  | 'bill_installments_invalid'
  | 'bill_reminder_invalid'
  | 'bill_notes_too_long'
  | 'bill_paid_amount_invalid'
  | 'bill_paid_on_invalid';

export function validateBillName(name: string): BillValidationCode | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'bill_name_required';
  }
  if (trimmed.length > BILL_NAME_MAX_LENGTH) {
    return 'bill_name_too_long';
  }
  return null;
}

export function validateBillAmount(amountMinor: number | null | undefined): BillValidationCode | null {
  if (
    amountMinor == null ||
    !Number.isInteger(amountMinor) ||
    amountMinor <= 0 ||
    amountMinor > MAX_AMOUNT_MINOR
  ) {
    return 'bill_amount_invalid';
  }
  return null;
}

export function validateBillCategory(category: string): BillValidationCode | null {
  if (!(BILL_CATEGORIES as readonly string[]).includes(category)) {
    return 'bill_category_invalid';
  }
  return null;
}

export function validateBillRecurrence(recurrence: string): BillValidationCode | null {
  if (!(BILL_RECURRENCES as readonly string[]).includes(recurrence)) {
    return 'bill_recurrence_invalid';
  }
  return null;
}

/** The first due date is required for bills and must be a real calendar date. */
export function validateBillDueDate(dueOn: string | null | undefined): BillValidationCode | null {
  if (dueOn == null || dueOn === '' || !isValidIsoDate(dueOn)) {
    return 'bill_due_invalid';
  }
  return null;
}

/**
 * Installment count is optional; when present it must be an integer in
 * [2, 240] and the bill must repeat (a one-off bill has no installments).
 */
export function validateBillInstallmentCount(
  count: number | null | undefined,
  recurrence: string,
): BillValidationCode | null {
  if (count == null) {
    return null;
  }
  if (
    !Number.isInteger(count) ||
    count < INSTALLMENT_COUNT_MIN ||
    count > INSTALLMENT_COUNT_MAX ||
    recurrence === 'none'
  ) {
    return 'bill_installments_invalid';
  }
  return null;
}

export function validateBillReminderDays(days: number | null | undefined): BillValidationCode | null {
  if (days == null) {
    return null;
  }
  if (!Number.isInteger(days) || days < 0 || days > REMINDER_DAYS_MAX) {
    return 'bill_reminder_invalid';
  }
  return null;
}

export function validateBillNotes(notes: string | null | undefined): BillValidationCode | null {
  if (notes && notes.trim().length > BILL_NOTES_MAX_LENGTH) {
    return 'bill_notes_too_long';
  }
  return null;
}

export function validatePaidAmount(amountMinor: number | null | undefined): BillValidationCode | null {
  if (
    amountMinor == null ||
    !Number.isInteger(amountMinor) ||
    amountMinor <= 0 ||
    amountMinor > MAX_AMOUNT_MINOR
  ) {
    return 'bill_paid_amount_invalid';
  }
  return null;
}

export function validatePaidOn(paidOn: string | null | undefined): BillValidationCode | null {
  if (paidOn == null || paidOn === '' || !isValidIsoDate(paidOn)) {
    return 'bill_paid_on_invalid';
  }
  return null;
}

/** Normalizes untrusted category input; unknown values map to `other`. */
export function asBillCategory(value: string): BillCategory {
  return (BILL_CATEGORIES as readonly string[]).includes(value) ? (value as BillCategory) : 'other';
}

/** Normalizes untrusted recurrence input; unknown values map to `monthly`. */
export function asBillRecurrence(value: string): BillRecurrence {
  return (BILL_RECURRENCES as readonly string[]).includes(value)
    ? (value as BillRecurrence)
    : 'monthly';
}
