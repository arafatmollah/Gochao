import type {
  FamilyRelationship,
  FamilyRequestCategory,
  FamilyRequestStatus,
} from '@/types/family';

/** Stable internal codes map to i18n keys — DB values are never translated (§9). */
export function relationshipLabelKey(relationship: FamilyRelationship): string {
  return `family.relationships.${relationship}`;
}

export function requestCategoryLabelKey(category: FamilyRequestCategory): string {
  return `family.categories.${category}`;
}

export function requestStatusLabelKey(status: FamilyRequestStatus): string {
  return `family.statuses.${status}`;
}
