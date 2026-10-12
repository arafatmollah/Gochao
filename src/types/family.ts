export const FAMILY_RELATIONSHIPS = [
  'self',
  'spouse',
  'father',
  'mother',
  'son',
  'daughter',
  'sibling',
  'other',
] as const;
export type FamilyRelationship = (typeof FAMILY_RELATIONSHIPS)[number];

export const FAMILY_REQUEST_CATEGORIES = [
  'medicine',
  'appointment',
  'grocery',
  'bill',
  'household',
  'other',
] as const;
export type FamilyRequestCategory = (typeof FAMILY_REQUEST_CATEGORIES)[number];

export const FAMILY_REQUEST_STATUSES = [
  'open',
  'in_progress',
  'done',
  'cancelled',
] as const;
export type FamilyRequestStatus = (typeof FAMILY_REQUEST_STATUSES)[number];

export const FAMILY_MEMBER_NAME_MAX_LENGTH = 80;
export const FAMILY_MEMBER_CONTACT_MAX_LENGTH = 200;
export const FAMILY_MEMBER_NOTES_MAX_LENGTH = 1000;
export const FAMILY_REQUEST_TITLE_MAX_LENGTH = 140;
export const FAMILY_REQUEST_DETAILS_MAX_LENGTH = 2000;

export interface FamilyMember {
  id: string;
  name: string;
  relationship: FamilyRelationship;
  /** Phone, email, or any other contact hint; plain text. */
  contact: string | null;
  notes: string | null;
  /** Archived members keep their requests but leave the active household. */
  isArchived: boolean;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
}

export interface FamilyRequest {
  id: string;
  title: string;
  details: string | null;
  /** Member the request is for; null when unassigned. */
  memberId: string | null;
  category: FamilyRequestCategory;
  priority: 'low' | 'medium' | 'high';
  /** Calendar deadline `YYYY-MM-DD`, or null when open-ended. */
  deadline: string | null;
  /** Expected cost in minor units (poisha), or null when not estimated. */
  estimatedCostMinor: number | null;
  status: FamilyRequestStatus;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
}

/** Request row enriched for list rendering. */
export interface FamilyRequestListItem extends FamilyRequest {
  memberName: string | null;
  /** Set once a task has been generated from this request. */
  taskId: string | null;
}

export interface CreateFamilyMemberInput {
  name: string;
  relationship: FamilyRelationship;
  contact?: string | null;
  notes?: string | null;
}

export interface UpdateFamilyMemberInput {
  name?: string;
  relationship?: FamilyRelationship;
  /** `undefined` keeps the current value, `null` clears it. */
  contact?: string | null;
  notes?: string | null;
  isArchived?: boolean;
}

export interface CreateFamilyRequestInput {
  title: string;
  details?: string | null;
  memberId?: string | null;
  category?: FamilyRequestCategory;
  priority?: 'low' | 'medium' | 'high';
  deadline?: string | null;
  estimatedCostMinor?: number | null;
}

export interface UpdateFamilyRequestInput {
  title?: string;
  details?: string | null;
  memberId?: string | null;
  category?: FamilyRequestCategory;
  priority?: 'low' | 'medium' | 'high';
  deadline?: string | null;
  estimatedCostMinor?: number | null;
}

export interface FamilyMemberFilter {
  /** `true` lists only archived members, `false` only active ones. */
  archived?: boolean;
  /** Case-insensitive substring match on name. */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface FamilyRequestFilter {
  status?: FamilyRequestStatus;
  /** Only requests whose status is `open` or `in_progress` (dashboard). */
  outstandingOnly?: boolean;
  memberId?: string;
  /** Case-insensitive substring match on title and details. */
  search?: string;
  limit?: number;
  offset?: number;
}
