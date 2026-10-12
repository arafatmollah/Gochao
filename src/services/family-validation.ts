import {
  FAMILY_MEMBER_CONTACT_MAX_LENGTH,
  FAMILY_MEMBER_NAME_MAX_LENGTH,
  FAMILY_MEMBER_NOTES_MAX_LENGTH,
  FAMILY_RELATIONSHIPS,
  FAMILY_REQUEST_CATEGORIES,
  FAMILY_REQUEST_DETAILS_MAX_LENGTH,
  FAMILY_REQUEST_STATUSES,
  FAMILY_REQUEST_TITLE_MAX_LENGTH,
} from '@/types/family';
import { isValidIsoDate } from '@/utils/dates';

/**
 * Shared family validation rules, used both by the forms (field-level
 * feedback) and by the services (authoritative check before persisting).
 * Validators return a stable machine-readable code (or null when valid);
 * the UI translates codes via `translateValidationCode`, services wrap them
 * in `AppError('validation', code)`.
 */

export type FamilyMemberValidationCode =
  | 'family_member_name_required'
  | 'family_member_name_too_long'
  | 'family_member_relationship_invalid'
  | 'family_member_contact_too_long'
  | 'family_member_notes_too_long';

export type FamilyRequestValidationCode =
  | 'family_request_title_required'
  | 'family_request_title_too_long'
  | 'family_request_details_too_long'
  | 'family_request_member_invalid'
  | 'family_request_category_invalid'
  | 'family_request_priority_invalid'
  | 'family_request_deadline_invalid'
  | 'family_request_cost_invalid'
  | 'family_request_status_invalid';

export function validateMemberName(name: string): FamilyMemberValidationCode | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'family_member_name_required';
  }
  if (trimmed.length > FAMILY_MEMBER_NAME_MAX_LENGTH) {
    return 'family_member_name_too_long';
  }
  return null;
}

export function validateMemberRelationship(
  relationship: string,
): FamilyMemberValidationCode | null {
  if (!(FAMILY_RELATIONSHIPS as readonly string[]).includes(relationship)) {
    return 'family_member_relationship_invalid';
  }
  return null;
}

export function validateMemberContact(
  contact: string | null | undefined,
): FamilyMemberValidationCode | null {
  if (contact && contact.trim().length > FAMILY_MEMBER_CONTACT_MAX_LENGTH) {
    return 'family_member_contact_too_long';
  }
  return null;
}

export function validateMemberNotes(
  notes: string | null | undefined,
): FamilyMemberValidationCode | null {
  if (notes && notes.trim().length > FAMILY_MEMBER_NOTES_MAX_LENGTH) {
    return 'family_member_notes_too_long';
  }
  return null;
}

export function validateRequestTitle(title: string): FamilyRequestValidationCode | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return 'family_request_title_required';
  }
  if (trimmed.length > FAMILY_REQUEST_TITLE_MAX_LENGTH) {
    return 'family_request_title_too_long';
  }
  return null;
}

export function validateRequestDetails(
  details: string | null | undefined,
): FamilyRequestValidationCode | null {
  if (details && details.trim().length > FAMILY_REQUEST_DETAILS_MAX_LENGTH) {
    return 'family_request_details_too_long';
  }
  return null;
}

export function validateRequestCategory(
  category: string,
): FamilyRequestValidationCode | null {
  if (!(FAMILY_REQUEST_CATEGORIES as readonly string[]).includes(category)) {
    return 'family_request_category_invalid';
  }
  return null;
}

export function validateRequestPriority(priority: string): FamilyRequestValidationCode | null {
  if (!['low', 'medium', 'high'].includes(priority)) {
    return 'family_request_priority_invalid';
  }
  return null;
}

export function validateRequestDeadline(
  deadline: string | null | undefined,
): FamilyRequestValidationCode | null {
  if (deadline == null || deadline === '') {
    return null;
  }
  if (!isValidIsoDate(deadline)) {
    return 'family_request_deadline_invalid';
  }
  return null;
}

export function validateRequestCost(
  estimatedCostMinor: number | null | undefined,
): FamilyRequestValidationCode | null {
  if (estimatedCostMinor == null) {
    return null;
  }
  if (!Number.isInteger(estimatedCostMinor) || estimatedCostMinor <= 0) {
    return 'family_request_cost_invalid';
  }
  return null;
}

export function validateRequestStatus(status: string): FamilyRequestValidationCode | null {
  if (!(FAMILY_REQUEST_STATUSES as readonly string[]).includes(status)) {
    return 'family_request_status_invalid';
  }
  return null;
}

/** Normalizes a priority value coming from untrusted input. */
export function asRequestPriority(value: string): 'low' | 'medium' | 'high' {
  return ['low', 'medium', 'high'].includes(value)
    ? (value as 'low' | 'medium' | 'high')
    : 'medium';
}
