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
import {
  FAMILY_MEMBER_CONTACT_MAX_LENGTH,
  FAMILY_MEMBER_NAME_MAX_LENGTH,
  FAMILY_MEMBER_NOTES_MAX_LENGTH,
  FAMILY_REQUEST_DETAILS_MAX_LENGTH,
  FAMILY_REQUEST_TITLE_MAX_LENGTH,
} from '@/types/family';
import {
  GROCERY_ITEM_NAME_MAX_LENGTH,
  GROCERY_LIST_NAME_MAX_LENGTH,
  GROCERY_NOTES_MAX_LENGTH,
  GROCERY_UNIT_MAX_LENGTH,
} from '@/types/grocery';
import {
  NOTE_CATEGORY_NAME_MAX_LENGTH,
  NOTE_CONTENT_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
} from '@/types/note';
import { PRAYER_CITY_MAX_LENGTH } from '@/types/prayer';
import {
  WATCH_NOTES_MAX_LENGTH,
  WATCH_TITLE_MAX_LENGTH,
  WATCH_URL_MAX_LENGTH,
} from '@/types/entertainment';
import {
  APPOINTMENT_DOCTOR_MAX_LENGTH,
  APPOINTMENT_NOTES_MAX_LENGTH,
  APPOINTMENT_PLACE_MAX_LENGTH,
  APPOINTMENT_TITLE_MAX_LENGTH,
  HEALTH_RECORD_CONTENT_MAX_LENGTH,
  HEALTH_RECORD_TITLE_MAX_LENGTH,
  MEDICINE_DOSAGE_MAX_LENGTH,
  MEDICINE_NAME_MAX_LENGTH,
  MEDICINE_NOTES_MAX_LENGTH,
  MEDICINE_PRESCRIBER_MAX_LENGTH,
  MEDICINE_STRENGTH_MAX_LENGTH,
} from '@/types/health';
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
  note_empty: 'validation.note_empty',
  note_title_too_long: 'validation.note_title_too_long',
  note_content_too_long: 'validation.note_content_too_long',
  note_category_name_required: 'validation.note_category_name_required',
  note_category_name_too_long: 'validation.note_category_name_too_long',
  note_category_unavailable: 'validation.note_category_unavailable',
  tag_name_required: 'validation.tag_name_required',
  tag_name_too_long: 'validation.tag_name_too_long',
  family_member_name_required: 'validation.family_member_name_required',
  family_member_name_too_long: 'validation.family_member_name_too_long',
  family_member_relationship_invalid: 'validation.family_member_relationship_invalid',
  family_member_contact_too_long: 'validation.family_member_contact_too_long',
  family_member_notes_too_long: 'validation.family_member_notes_too_long',
  family_request_title_required: 'validation.family_request_title_required',
  family_request_title_too_long: 'validation.family_request_title_too_long',
  family_request_details_too_long: 'validation.family_request_details_too_long',
  family_request_member_invalid: 'validation.family_request_member_invalid',
  family_request_category_invalid: 'validation.family_request_category_invalid',
  family_request_priority_invalid: 'validation.family_request_priority_invalid',
  family_request_deadline_invalid: 'validation.family_request_deadline_invalid',
  family_request_cost_invalid: 'validation.family_request_cost_invalid',
  family_request_status_invalid: 'validation.family_request_status_invalid',
  grocery_list_name_required: 'validation.grocery_list_name_required',
  grocery_list_name_too_long: 'validation.grocery_list_name_too_long',
  grocery_notes_too_long: 'validation.grocery_notes_too_long',
  grocery_item_name_required: 'validation.grocery_item_name_required',
  grocery_item_name_too_long: 'validation.grocery_item_name_too_long',
  grocery_quantity_invalid: 'validation.grocery_quantity_invalid',
  grocery_unit_too_long: 'validation.grocery_unit_too_long',
  grocery_price_invalid: 'validation.grocery_price_invalid',
  grocery_member_invalid: 'validation.grocery_member_invalid',
  prayer_method_invalid: 'validation.prayer_method_invalid',
  prayer_madhab_invalid: 'validation.prayer_madhab_invalid',
  prayer_latitude_invalid: 'validation.prayer_latitude_invalid',
  prayer_longitude_invalid: 'validation.prayer_longitude_invalid',
  prayer_city_too_long: 'validation.prayer_city_too_long',
  prayer_timezone_invalid: 'validation.prayer_timezone_invalid',
  prayer_adjust_invalid: 'validation.prayer_adjust_invalid',
  prayer_date_invalid: 'validation.prayer_date_invalid',
  prayer_name_invalid: 'validation.prayer_name_invalid',
  prayer_status_invalid: 'validation.prayer_status_invalid',
  medicine_name_required: 'validation.medicine_name_required',
  medicine_name_too_long: 'validation.medicine_name_too_long',
  medicine_strength_too_long: 'validation.medicine_strength_too_long',
  medicine_dosage_too_long: 'validation.medicine_dosage_too_long',
  medicine_frequency_invalid: 'validation.medicine_frequency_invalid',
  medicine_date_invalid: 'validation.medicine_date_invalid',
  medicine_end_before_start: 'validation.medicine_end_before_start',
  medicine_prescriber_too_long: 'validation.medicine_prescriber_too_long',
  medicine_notes_too_long: 'validation.medicine_notes_too_long',
  medicine_time_required: 'validation.medicine_time_required',
  medicine_time_invalid: 'validation.medicine_time_invalid',
  medicine_weekdays_invalid: 'validation.medicine_weekdays_invalid',
  medicine_schedule_unknown: 'validation.medicine_schedule_unknown',
  dose_status_invalid: 'validation.dose_status_invalid',
  appointment_title_required: 'validation.appointment_title_required',
  appointment_title_too_long: 'validation.appointment_title_too_long',
  appointment_doctor_too_long: 'validation.appointment_doctor_too_long',
  appointment_place_too_long: 'validation.appointment_place_too_long',
  appointment_date_invalid: 'validation.appointment_date_invalid',
  appointment_time_invalid: 'validation.appointment_time_invalid',
  appointment_notes_too_long: 'validation.appointment_notes_too_long',
  health_record_title_required: 'validation.health_record_title_required',
  health_record_title_too_long: 'validation.health_record_title_too_long',
  health_record_content_too_long: 'validation.health_record_content_too_long',
  health_record_date_invalid: 'validation.health_record_date_invalid',
  watch_title_required: 'validation.watch_title_required',
  watch_title_too_long: 'validation.watch_title_too_long',
  watch_kind_invalid: 'validation.watch_kind_invalid',
  watch_status_invalid: 'validation.watch_status_invalid',
  watch_url_invalid: 'validation.watch_url_invalid',
  watch_url_too_long: 'validation.watch_url_too_long',
  watch_rating_invalid: 'validation.watch_rating_invalid',
  watch_notes_too_long: 'validation.watch_notes_too_long',
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
  note_category_name_taken: 'errors.note_category_name_taken',
  family_member_has_requests: 'errors.familyMemberHasRequests',
  family_request_task_exists: 'errors.familyRequestTaskExists',
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
    case 'note_title_too_long':
      return t(key, { max: NOTE_TITLE_MAX_LENGTH });
    case 'note_content_too_long':
      return t(key, { max: NOTE_CONTENT_MAX_LENGTH });
    case 'note_category_name_too_long':
      return t(key, { max: NOTE_CATEGORY_NAME_MAX_LENGTH });
    case 'tag_name_too_long':
      return t(key, { max: TAG_NAME_MAX_LENGTH });
    case 'family_member_name_too_long':
      return t(key, { max: FAMILY_MEMBER_NAME_MAX_LENGTH });
    case 'family_member_contact_too_long':
      return t(key, { max: FAMILY_MEMBER_CONTACT_MAX_LENGTH });
    case 'family_member_notes_too_long':
      return t(key, { max: FAMILY_MEMBER_NOTES_MAX_LENGTH });
    case 'family_request_title_too_long':
      return t(key, { max: FAMILY_REQUEST_TITLE_MAX_LENGTH });
    case 'family_request_details_too_long':
      return t(key, { max: FAMILY_REQUEST_DETAILS_MAX_LENGTH });
    case 'grocery_list_name_too_long':
      return t(key, { max: GROCERY_LIST_NAME_MAX_LENGTH });
    case 'grocery_notes_too_long':
      return t(key, { max: GROCERY_NOTES_MAX_LENGTH });
    case 'grocery_item_name_too_long':
      return t(key, { max: GROCERY_ITEM_NAME_MAX_LENGTH });
    case 'grocery_unit_too_long':
      return t(key, { max: GROCERY_UNIT_MAX_LENGTH });
    case 'prayer_city_too_long':
      return t(key, { max: PRAYER_CITY_MAX_LENGTH });
    case 'medicine_name_too_long':
      return t(key, { max: MEDICINE_NAME_MAX_LENGTH });
    case 'medicine_strength_too_long':
      return t(key, { max: MEDICINE_STRENGTH_MAX_LENGTH });
    case 'medicine_dosage_too_long':
      return t(key, { max: MEDICINE_DOSAGE_MAX_LENGTH });
    case 'medicine_prescriber_too_long':
      return t(key, { max: MEDICINE_PRESCRIBER_MAX_LENGTH });
    case 'medicine_notes_too_long':
      return t(key, { max: MEDICINE_NOTES_MAX_LENGTH });
    case 'appointment_title_too_long':
      return t(key, { max: APPOINTMENT_TITLE_MAX_LENGTH });
    case 'appointment_doctor_too_long':
      return t(key, { max: APPOINTMENT_DOCTOR_MAX_LENGTH });
    case 'appointment_place_too_long':
      return t(key, { max: APPOINTMENT_PLACE_MAX_LENGTH });
    case 'appointment_notes_too_long':
      return t(key, { max: APPOINTMENT_NOTES_MAX_LENGTH });
    case 'health_record_title_too_long':
      return t(key, { max: HEALTH_RECORD_TITLE_MAX_LENGTH });
    case 'health_record_content_too_long':
      return t(key, { max: HEALTH_RECORD_CONTENT_MAX_LENGTH });
    case 'watch_title_too_long':
      return t(key, { max: WATCH_TITLE_MAX_LENGTH });
    case 'watch_url_too_long':
      return t(key, { max: WATCH_URL_MAX_LENGTH });
    case 'watch_notes_too_long':
      return t(key, { max: WATCH_NOTES_MAX_LENGTH });
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
    console.warn('[gochao] unexpected error:', detail);
  }
  return t('errors.generic');
}
