import {
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_TYPES,
  CATEGORY_KINDS,
  CATEGORY_NAME_MAX_LENGTH,
  TRANSFER_NOTES_MAX_LENGTH,
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  TRANSACTION_KINDS,
  TRANSACTION_NOTES_MAX_LENGTH,
  TRANSACTION_RECIPIENT_MAX_LENGTH,
  type AccountType,
  type CategoryKind,
  type TransactionKind,
} from '@/types/finance';
import { isValidIsoDate } from '@/utils/dates';
import { MAX_AMOUNT_MINOR } from '@/utils/money';

/**
 * Shared finance validation rules (Module D), used by the forms for
 * field-level feedback and by the finance services as the authoritative
 * check before persisting. Same contract as bill validation: validators
 * return a stable machine-readable code or null; services wrap codes in
 * `AppError('validation', code)`; the UI translates via `translateValidationCode`.
 */

export type FinanceValidationCode =
  | 'account_name_required'
  | 'account_name_too_long'
  | 'account_type_invalid'
  | 'account_opening_balance_invalid'
  | 'account_unavailable'
  | 'category_name_required'
  | 'category_name_too_long'
  | 'category_kind_invalid'
  | 'category_unavailable'
  | 'budget_category_invalid'
  | 'transaction_kind_invalid'
  | 'transaction_amount_invalid'
  | 'transaction_date_invalid'
  | 'transaction_description_required'
  | 'transaction_description_too_long'
  | 'transaction_recipient_too_long'
  | 'transaction_notes_too_long'
  | 'transfer_amount_invalid'
  | 'transfer_date_invalid'
  | 'transfer_same_account'
  | 'transfer_notes_too_long'
  | 'budget_amount_invalid';

/** Amounts that may be zero (e.g. opening balance); strictly positive ones use `positiveAmountError`. */
export function amountError(
  amountMinor: number | null | undefined,
  code: FinanceValidationCode,
  options: { allowZero?: boolean } = {},
): FinanceValidationCode | null {
  const minimum = options.allowZero ? 0 : 1;
  if (
    amountMinor == null ||
    !Number.isInteger(amountMinor) ||
    amountMinor < minimum ||
    amountMinor > MAX_AMOUNT_MINOR
  ) {
    return code;
  }
  return null;
}

export function validateAccountName(name: string): FinanceValidationCode | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'account_name_required';
  }
  if (trimmed.length > ACCOUNT_NAME_MAX_LENGTH) {
    return 'account_name_too_long';
  }
  return null;
}

export function validateAccountType(type: string): FinanceValidationCode | null {
  if (!(ACCOUNT_TYPES as readonly string[]).includes(type)) {
    return 'account_type_invalid';
  }
  return null;
}

export function validateCategoryName(name: string): FinanceValidationCode | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'category_name_required';
  }
  if (trimmed.length > CATEGORY_NAME_MAX_LENGTH) {
    return 'category_name_too_long';
  }
  return null;
}

export function validateCategoryKind(kind: string): FinanceValidationCode | null {
  if (!(CATEGORY_KINDS as readonly string[]).includes(kind)) {
    return 'category_kind_invalid';
  }
  return null;
}

export function validateTransactionKind(kind: string): FinanceValidationCode | null {
  if (!(TRANSACTION_KINDS as readonly string[]).includes(kind)) {
    return 'transaction_kind_invalid';
  }
  return null;
}

export function validateTransactionDescription(description: string): FinanceValidationCode | null {
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return 'transaction_description_required';
  }
  if (trimmed.length > TRANSACTION_DESCRIPTION_MAX_LENGTH) {
    return 'transaction_description_too_long';
  }
  return null;
}

export function validateRecipient(recipient: string | null | undefined): FinanceValidationCode | null {
  if (recipient && recipient.trim().length > TRANSACTION_RECIPIENT_MAX_LENGTH) {
    return 'transaction_recipient_too_long';
  }
  return null;
}

export function validateTransactionNotes(notes: string | null | undefined): FinanceValidationCode | null {
  if (notes && notes.trim().length > TRANSACTION_NOTES_MAX_LENGTH) {
    return 'transaction_notes_too_long';
  }
  return null;
}

export function validateTransferNotes(notes: string | null | undefined): FinanceValidationCode | null {
  if (notes && notes.trim().length > TRANSFER_NOTES_MAX_LENGTH) {
    return 'transfer_notes_too_long';
  }
  return null;
}

/** Calendar date required (`YYYY-MM-DD`); transfers and transactions share the rule. */
export function validateOccurredOn(
  occurredOn: string | null | undefined,
  code: 'transaction_date_invalid' | 'transfer_date_invalid',
): FinanceValidationCode | null {
  if (occurredOn == null || occurredOn === '' || !isValidIsoDate(occurredOn)) {
    return code;
  }
  return null;
}

export function validateTransferAccounts(fromAccountId: string, toAccountId: string): FinanceValidationCode | null {
  if (fromAccountId === toAccountId) {
    return 'transfer_same_account';
  }
  return null;
}

/** Normalizes untrusted account type input; unknown values map to `cash`. */
export function asAccountType(value: string): AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(value) ? (value as AccountType) : 'cash';
}

/** Normalizes untrusted category kind input; unknown values map to `expense`. */
export function asCategoryKind(value: string): CategoryKind {
  return (CATEGORY_KINDS as readonly string[]).includes(value) ? (value as CategoryKind) : 'expense';
}

/** Normalizes untrusted transaction kind input; unknown values map to `expense`. */
export function asTransactionKind(value: string): TransactionKind {
  return (TRANSACTION_KINDS as readonly string[]).includes(value)
    ? (value as TransactionKind)
    : 'expense';
}
