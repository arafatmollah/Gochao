import {
  GROCERY_ITEM_NAME_MAX_LENGTH,
  GROCERY_LIST_NAME_MAX_LENGTH,
  GROCERY_NOTES_MAX_LENGTH,
  GROCERY_QUANTITY_MAX,
  GROCERY_UNIT_MAX_LENGTH,
} from '@/types/grocery';
import { MAX_AMOUNT_MINOR, normalizeDigitInput } from '@/utils/money';

/**
 * Shared grocery validation rules, used both by the forms (field-level
 * feedback) and by the grocery service (authoritative check before
 * persisting).
 *
 * Validators return a stable machine-readable code (or null when valid).
 * The UI translates codes into localized copy via `translateValidationCode`;
 * services wrap them in `AppError('validation', code)`.
 */

export type GroceryValidationCode =
  | 'grocery_list_name_required'
  | 'grocery_list_name_too_long'
  | 'grocery_notes_too_long'
  | 'grocery_item_name_required'
  | 'grocery_item_name_too_long'
  | 'grocery_quantity_invalid'
  | 'grocery_unit_too_long'
  | 'grocery_price_invalid'
  | 'grocery_member_invalid';

export function validateGroceryListName(name: string): GroceryValidationCode | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'grocery_list_name_required';
  }
  if (trimmed.length > GROCERY_LIST_NAME_MAX_LENGTH) {
    return 'grocery_list_name_too_long';
  }
  return null;
}

export function validateGroceryNotes(
  notes: string | null | undefined,
): GroceryValidationCode | null {
  if (notes && notes.trim().length > GROCERY_NOTES_MAX_LENGTH) {
    return 'grocery_notes_too_long';
  }
  return null;
}

export function validateGroceryItemName(name: string): GroceryValidationCode | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'grocery_item_name_required';
  }
  if (trimmed.length > GROCERY_ITEM_NAME_MAX_LENGTH) {
    return 'grocery_item_name_too_long';
  }
  return null;
}

/**
 * Parses user-typed quantity text into a positive number. Accepts Bangla
 * digits and up to two decimal places (`2`, `2.5`, `০.৫`). Returns null when
 * the text is not a usable quantity.
 */
export function parseQuantityInput(value: string): number | null {
  const normalized = normalizeDigitInput(value).trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const quantity = Number(normalized);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > GROCERY_QUANTITY_MAX) {
    return null;
  }
  return quantity;
}

export function validateGroceryQuantity(quantity: unknown): GroceryValidationCode | null {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    return 'grocery_quantity_invalid';
  }
  if (quantity <= 0 || quantity > GROCERY_QUANTITY_MAX) {
    return 'grocery_quantity_invalid';
  }
  // At most two decimal places, mirroring `parseQuantityInput`.
  if (!/^\d+(\.\d{1,2})?$/.test(String(quantity))) {
    return 'grocery_quantity_invalid';
  }
  return null;
}

export function validateGroceryUnit(unit: string | null | undefined): GroceryValidationCode | null {
  if (unit == null || unit.trim() === '') {
    return null;
  }
  if (unit.trim().length > GROCERY_UNIT_MAX_LENGTH) {
    return 'grocery_unit_too_long';
  }
  return null;
}

/**
 * A price is optional (null = unknown), but when present it must be a
 * non-negative integer within the app-wide money range. Zero is allowed —
 * a free item is a legitimate price.
 */
export function validateGroceryPrice(priceMinor: number | null | undefined): GroceryValidationCode | null {
  if (priceMinor == null) {
    return null;
  }
  if (!Number.isSafeInteger(priceMinor) || priceMinor < 0 || priceMinor > MAX_AMOUNT_MINOR) {
    return 'grocery_price_invalid';
  }
  return null;
}
