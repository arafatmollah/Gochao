/**
 * Maps errors coming out of services and validation into localized copy.
 * Services carry stable codes (`AppError.code`, validation codes); the
 * translation happens here at the UI boundary.
 */

import {
  BILL_NAME_MAX_LENGTH,
  BILL_NOTES_MAX_LENGTH,
  INSTALLMENT_COUNT_MAX,
  INSTALLMENT_COUNT_MIN,
  REMINDER_DAYS_MAX,
} from '@/types/bill';
import {
  ACCOUNT_NAME_MAX_LENGTH,
  CATEGORY_NAME_MAX_LENGTH,
  TRANSFER_NOTES_MAX_LENGTH,
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  TRANSACTION_NOTES_MAX_LENGTH,
  TRANSACTION_RECIPIENT_MAX_LENGTH,
} from '@/types/finance';
import { TASK_DESCRIPTION_MAX_LENGTH, TASK_TITLE_MAX_LENGTH } from '@/types/task';
import { isAppError } from '@/utils/errors';

import type { TranslateFn } from './translate';

const VALIDATION_KEYS: Record<string, string> = {
  title_required: 'validation.title_required',
  title_too_long: 'validation.title_too_long',
  description_too_long: 'validation.description_too_long',
  due_invalid: 'validation.due_invalid',
  priority_invalid: 'validation.priority_invalid',
  bill_name_required: 'validation.bill_name_required',
  bill_name_too_long: 'validation.bill_name_too_long',
  bill_amount_invalid: 'validation.bill_amount_invalid',
  bill_category_invalid: 'validation.bill_category_invalid',
  bill_recurrence_invalid: 'validation.bill_recurrence_invalid',
  bill_due_invalid: 'validation.bill_due_invalid',
  bill_installments_invalid: 'validation.bill_installments_invalid',
  bill_reminder_invalid: 'validation.bill_reminder_invalid',
  bill_notes_too_long: 'validation.bill_notes_too_long',
  bill_paid_amount_invalid: 'validation.bill_paid_amount_invalid',
  bill_paid_on_invalid: 'validation.bill_paid_on_invalid',
  account_name_required: 'validation.account_name_required',
  account_name_too_long: 'validation.account_name_too_long',
  account_type_invalid: 'validation.account_type_invalid',
  account_opening_balance_invalid: 'validation.account_opening_balance_invalid',
  account_unavailable: 'validation.account_unavailable',
  category_name_required: 'validation.category_name_required',
  category_name_too_long: 'validation.category_name_too_long',
  category_kind_invalid: 'validation.category_kind_invalid',
  category_unavailable: 'validation.category_unavailable',
  budget_category_invalid: 'validation.budget_category_invalid',
  transaction_kind_invalid: 'validation.transaction_kind_invalid',
  transaction_amount_invalid: 'validation.transaction_amount_invalid',
  transaction_date_invalid: 'validation.transaction_date_invalid',
  transaction_description_required: 'validation.transaction_description_required',
  transaction_description_too_long: 'validation.transaction_description_too_long',
  transaction_recipient_too_long: 'validation.transaction_recipient_too_long',
  transaction_notes_too_long: 'validation.transaction_notes_too_long',
  transfer_amount_invalid: 'validation.transfer_amount_invalid',
  transfer_date_invalid: 'validation.transfer_date_invalid',
  transfer_same_account: 'validation.transfer_same_account',
  transfer_notes_too_long: 'validation.transfer_notes_too_long',
  budget_amount_invalid: 'validation.budget_amount_invalid',
};

/** Conflict reasons with dedicated copy; anything else uses `errors.conflict`. */
const CONFLICT_KEYS: Record<string, string> = {
  bill_has_payments: 'errors.billHasPayments',
  account_name_taken: 'errors.account_name_taken',
  account_in_use: 'errors.account_in_use',
  category_name_taken: 'errors.category_name_taken',
  category_builtin: 'errors.category_builtin',
  category_in_use: 'errors.category_in_use',
  budget_exists: 'errors.budget_exists',
  transaction_linked_to_bill: 'errors.transaction_linked_to_bill',
};

/** Translates a validation code (as returned by `task-validation`) to copy. */
export function translateValidationCode(code: string | null | undefined, t: TranslateFn): string {
  if (!code) {
    return '';
  }
  const key = VALIDATION_KEYS[code];
  if (!key) {
    return t('errors.generic');
  }
  switch (code) {
    case 'title_too_long':
      return t(key, { max: TASK_TITLE_MAX_LENGTH });
    case 'description_too_long':
      return t(key, { max: TASK_DESCRIPTION_MAX_LENGTH });
    case 'bill_name_too_long':
      return t(key, { max: BILL_NAME_MAX_LENGTH });
    case 'bill_notes_too_long':
      return t(key, { max: BILL_NOTES_MAX_LENGTH });
    case 'bill_installments_invalid':
      return t(key, { min: INSTALLMENT_COUNT_MIN, max: INSTALLMENT_COUNT_MAX });
    case 'bill_reminder_invalid':
      return t(key, { max: REMINDER_DAYS_MAX });
    case 'account_name_too_long':
      return t(key, { max: ACCOUNT_NAME_MAX_LENGTH });
    case 'category_name_too_long':
      return t(key, { max: CATEGORY_NAME_MAX_LENGTH });
    case 'transaction_description_too_long':
      return t(key, { max: TRANSACTION_DESCRIPTION_MAX_LENGTH });
    case 'transaction_recipient_too_long':
      return t(key, { max: TRANSACTION_RECIPIENT_MAX_LENGTH });
    case 'transaction_notes_too_long':
      return t(key, { max: TRANSACTION_NOTES_MAX_LENGTH });
    case 'transfer_notes_too_long':
      return t(key, { max: TRANSFER_NOTES_MAX_LENGTH });
    default:
      return t(key);
  }
}

/** Translates any thrown value to user-safe, localized copy. */
export function translateError(error: unknown, t: TranslateFn): string {
  if (isAppError(error)) {
    switch (error.code) {
      case 'validation':
        return translateValidationCode(error.message, t);
      case 'not_found':
        return t('errors.notFound');
      case 'database':
        return t('errors.database');
      case 'conflict': {
        const conflictKey = CONFLICT_KEYS[error.message];
        return conflictKey ? t(conflictKey) : t('errors.conflict');
      }
      default:
        break;
    }
  }
  if (__DEV__) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn('[jibon] unexpected error:', detail);
  }
  return t('errors.generic');
}
