/**
 * Display helpers for finance rows and headers. Money stays integer minor
 * units everywhere; only display strings are built here.
 */

import { formatMoney } from '@/i18n/format';
import { toLocaleDigits, type Locale, type TranslateFn } from '@/i18n/translate';
import type { ActivityKind } from '@/types/finance';

/** `+৳1,250` for income, `-৳1,250` for expenses, `৳1,250` for transfers. */
export function signedMoneyText(
  amountMinor: number,
  kind: ActivityKind,
  locale: Locale,
): string {
  const formatted = formatMoney(amountMinor, locale);
  if (kind === 'income') return `+${formatted}`;
  if (kind === 'expense') return `-${formatted}`;
  return formatted;
}

/** `2026-10` -> `October 2026` / `অক্টোবর ২০২৬`. */
export function monthKeyLabel(monthKey: string, t: TranslateFn, locale: Locale): string {
  const [year, month] = monthKey.split('-');
  const monthIndex = Number(month) - 1;
  return `${t(`dates.months.${monthIndex}`)} ${toLocaleDigits(year, locale)}`;
}
