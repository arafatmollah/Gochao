/**
 * Money helpers. Amounts are integer minor units (poisha) everywhere —
 * 1 BDT = 100 minor units — never floating-point values (master prompt §17.7).
 * Parsing and formatting are the only place decimal text appears.
 */

/** Upper bound for any amount, in minor units (≈ ৳9.99 billion). */
export const MAX_AMOUNT_MINOR = 999_999_999_999;

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

/** Maps Bangla digits (০-৯) in user input to ASCII digits. */
export function normalizeDigitInput(value: string): string {
  return value.replace(/[\u09E6-\u09EF]/g, (digit) =>
    String(BN_DIGITS.indexOf(digit as (typeof BN_DIGITS)[number])),
  );
}

/**
 * Parses user-typed BDT text into integer minor units.
 * Accepts `1250`, `1250.5`, `1250.50`, `1,250.50`, and Bangla digits.
 * Internal whitespace is rejected (rather than stripped) so a mistyped
 * `1 250 50` can never silently become a different amount.
 * Returns null when the text is not a positive amount within range.
 */
export function parseAmountToMinor(value: string): number | null {
  const normalized = normalizeDigitInput(value).trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const [whole, fraction = ''] = normalized.split('.');
  const minor = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > MAX_AMOUNT_MINOR) {
    return null;
  }
  return minor;
}

/** Formats minor units back to plain input text (`125050` -> `1250.50`). */
export function minorToInputText(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0')}`;
}
