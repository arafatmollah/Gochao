/**
 * Grocery domain types (master prompt Module G).
 *
 * Money is integer minor units (poisha) everywhere — never floats. Prices
 * are optional: an item can be listed with no price, an estimate only, or an
 * estimate plus the actual price paid.
 */

export const GROCERY_LIST_NAME_MAX_LENGTH = 120;
export const GROCERY_NOTES_MAX_LENGTH = 2000;
export const GROCERY_ITEM_NAME_MAX_LENGTH = 120;
export const GROCERY_UNIT_MAX_LENGTH = 24;

/** Upper bound for a single quantity (protects against mistyped input). */
export const GROCERY_QUANTITY_MAX = 1_000_000;

export interface GroceryList {
  id: string;
  name: string;
  notes: string | null;
  isArchived: boolean;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
}

export interface GroceryItem {
  id: string;
  listId: string;
  name: string;
  quantity: number;
  /** Free-text unit (`kg`, `pcs`, …); null when no unit was entered. */
  unit: string | null;
  /** Planning estimate in minor units; null when unknown. Never an expense. */
  estimatedPriceMinor: number | null;
  /** What was actually paid, in minor units; null until recorded. */
  actualPriceMinor: number | null;
  isPurchased: boolean;
  /** ISO-8601 UTC timestamp, set exactly when `isPurchased` is true. */
  purchasedAt: string | null;
  /** Assigned family member, if any. */
  assignedMemberId: string | null;
  notes: string | null;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
}

/** Grocery item plus the assignee's display name for list rendering. */
export interface GroceryItemWithMember extends GroceryItem {
  assignedMemberName: string | null;
}

/** Grocery list plus live aggregates for the list overview. */
export interface GroceryListSummary extends GroceryList {
  totalItems: number;
  remainingItems: number;
  /** Sum of estimate minor units over items that have one. */
  estimatedTotalMinor: number;
  /** Sum of actual minor units over items that have one. */
  actualTotalMinor: number;
}

export interface CreateGroceryListInput {
  name: string;
  notes?: string | null;
}

export interface UpdateGroceryListInput {
  name?: string;
  notes?: string | null;
}

export interface CreateGroceryItemInput {
  name: string;
  quantity?: number;
  unit?: string | null;
  estimatedPriceMinor?: number | null;
  actualPriceMinor?: number | null;
  assignedMemberId?: string | null;
  notes?: string | null;
}

export interface UpdateGroceryItemInput {
  name?: string;
  quantity?: number;
  unit?: string | null;
  estimatedPriceMinor?: number | null;
  actualPriceMinor?: number | null;
  assignedMemberId?: string | null;
  notes?: string | null;
}

export interface GroceryListFilter {
  /** When omitted, both active and archived lists are returned. */
  archived?: boolean;
  /** Case-insensitive substring match on list name. */
  search?: string;
  limit?: number;
  offset?: number;
}

export type GroceryItemStatusFilter = 'all' | 'remaining' | 'purchased';

export interface GroceryItemFilter {
  purchased?: boolean;
  /** Case-insensitive substring match on item name. */
  search?: string;
  limit?: number;
  offset?: number;
}
