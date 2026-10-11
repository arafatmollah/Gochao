import type { Ionicons } from '@expo/vector-icons';

import type { TranslateFn } from '@/i18n/translate';
import type { AccountType, Category } from '@/types/finance';

/** Icon per account type (labels come from `finance.accountTypes.*`). */
export const ACCOUNT_TYPE_ICONS: Record<AccountType, keyof typeof Ionicons.glyphMap> = {
  cash: 'cash-outline',
  bank: 'business-outline',
  mfs: 'phone-portrait-outline',
  savings: 'lock-closed-outline',
  other: 'wallet-outline',
};

/** Icons for the 19 seeded built-in categories, keyed by their stable ids. */
const BUILTIN_CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  cat_income_salary: 'cash-outline',
  cat_income_freelance: 'laptop-outline',
  cat_income_business: 'storefront-outline',
  cat_income_gift: 'gift-outline',
  cat_income_refund: 'return-down-back-outline',
  cat_income_other: 'add-circle-outline',
  cat_expense_food: 'restaurant-outline',
  cat_expense_groceries: 'basket-outline',
  cat_expense_transport: 'bus-outline',
  cat_expense_rent: 'home-outline',
  cat_expense_utilities: 'flash-outline',
  cat_expense_healthcare: 'medkit-outline',
  cat_expense_medicine: 'medical-outline',
  cat_expense_education: 'school-outline',
  cat_expense_family: 'people-outline',
  cat_expense_shopping: 'bag-handle-outline',
  cat_expense_subscriptions: 'repeat-outline',
  cat_expense_entertainment: 'game-controller-outline',
  cat_expense_other: 'ellipsis-horizontal-circle-outline',
};

/** Custom categories fall back to a kind-based arrow. */
export function categoryIcon(category: Pick<Category, 'id' | 'kind' | 'isBuiltin'>) {
  if (category.isBuiltin) {
    return BUILTIN_CATEGORY_ICONS[category.id] ?? 'pricetag-outline';
  }
  return category.kind === 'income' ? 'trending-up-outline' : 'trending-down-outline';
}

/**
 * Built-in categories are displayed via `finance.categoryNames.<id>` so the
 * stored English name is never shown in Bangla; custom categories show the
 * name the user typed (never translated).
 */
export function categoryDisplayName(
  category: Pick<Category, 'id' | 'name' | 'isBuiltin'>,
  t: TranslateFn,
): string {
  return category.isBuiltin ? t(`finance.categoryNames.${category.id}`) : category.name;
}
