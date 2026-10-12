import { translateError, translateValidationCode } from '@/i18n/errors';
import bnDict from '@/i18n/locales/bn.json';
import enDict from '@/i18n/locales/en.json';
import { createTranslator } from '@/i18n/translate';
import { AppError } from '@/utils/errors';

const en = createTranslator('en', enDict, enDict);
const bn = createTranslator('bn', bnDict, enDict);

describe('translateValidationCode', () => {
  it('returns empty copy for no code', () => {
    expect(translateValidationCode(null, en)).toBe('');
    expect(translateValidationCode(undefined, en)).toBe('');
  });

  it('translates task codes', () => {
    expect(translateValidationCode('title_required', en)).toBe('Please enter a task title.');
    expect(translateValidationCode('title_too_long', en)).toBe(
      'Keep the title under 140 characters.',
    );
  });

  it('translates bill codes, interpolating shared limit constants', () => {
    expect(translateValidationCode('bill_name_required', bn)).toBe(
      'অনুগ্রহ করে বিলের নাম লিখুন।',
    );
    expect(translateValidationCode('bill_name_too_long', en)).toBe(
      'Keep the bill name under 140 characters.',
    );
    expect(translateValidationCode('bill_installments_invalid', en)).toBe(
      'Installments must be a whole number between 2 and 240.',
    );
    expect(translateValidationCode('bill_reminder_invalid', en)).toBe(
      'Remind me must be a whole number of days from 0 to 30.',
    );
    expect(translateValidationCode('bill_notes_too_long', en)).toBe(
      'Keep notes under 2000 characters.',
    );
    expect(translateValidationCode('bill_paid_on_invalid', bn)).toBe(
      'অনুগ্রহ করে সঠিক পরিশোধের তারিখ দিন।',
    );
  });

  it('translates finance codes, interpolating shared limit constants', () => {
    expect(translateValidationCode('account_name_required', bn)).toBe(
      'অনুগ্রহ করে অ্যাকাউন্টের নাম লিখুন।',
    );
    expect(translateValidationCode('account_name_too_long', en)).toBe(
      'Keep the account name under 140 characters.',
    );
    expect(translateValidationCode('category_name_too_long', en)).toBe(
      'Keep the category name under 60 characters.',
    );
    expect(translateValidationCode('transaction_recipient_too_long', en)).toBe(
      'Keep the paid-to name under 140 characters.',
    );
    expect(translateValidationCode('transfer_notes_too_long', en)).toBe(
      'Keep notes under 2000 characters.',
    );
    expect(translateValidationCode('transfer_same_account', bn)).toBe(
      'স্থানান্তরের জন্য দুটি আলাদা অ্যাকাউন্ট বেছে নিন।',
    );
    expect(translateValidationCode('account_opening_balance_invalid', en)).toBe(
      'Enter an opening balance of zero or more, like 0 or 2500.50.',
    );
  });

  it('translates grocery codes, interpolating shared limit constants', () => {
    expect(translateValidationCode('grocery_list_name_required', en)).toBe(
      'Please enter a list name.',
    );
    expect(translateValidationCode('grocery_list_name_too_long', en)).toBe(
      'Keep the list name under 120 characters.',
    );
    expect(translateValidationCode('grocery_item_name_required', bn)).toBe(
      'পণ্যের নাম লিখুন।',
    );
    expect(translateValidationCode('grocery_quantity_invalid', en)).toBe(
      'Enter a quantity greater than zero.',
    );
    expect(translateValidationCode('grocery_price_invalid', en)).toBe(
      'Enter a price greater than zero, or leave it blank.',
    );
    expect(translateValidationCode('grocery_member_invalid', bn)).toBe(
      'এই সদস্য উপলব্ধ নেই। অন্য কাউকে বেছে নিন।',
    );
  });

  it('translates prayer codes, interpolating shared limit constants', () => {
    expect(translateValidationCode('prayer_method_invalid', en)).toBe(
      'Please choose a valid calculation method.',
    );
    expect(translateValidationCode('prayer_latitude_invalid', en)).toBe(
      'Enter a latitude between -90 and 90.',
    );
    expect(translateValidationCode('prayer_city_too_long', en)).toBe(
      'Keep the place name under 60 characters.',
    );
    expect(translateValidationCode('prayer_adjust_invalid', bn)).toBe(
      'সমন্বয় -৬০ থেকে ৬০ মিনিটের পূর্ণ সংখ্যা হতে হবে।',
    );
  });

  it('translates health codes, interpolating shared limit constants', () => {
    expect(translateValidationCode('medicine_name_required', en)).toBe(
      'Please enter a medicine name.',
    );
    expect(translateValidationCode('medicine_name_too_long', en)).toBe(
      'Keep the medicine name under 120 characters.',
    );
    expect(translateValidationCode('medicine_end_before_start', en)).toBe(
      'The end date cannot be before the start date.',
    );
    expect(translateValidationCode('appointment_title_required', bn)).toBe(
      'ভিজিটের নাম লিখুন।',
    );
    expect(translateValidationCode('health_record_content_too_long', en)).toBe(
      'Keep the note under 10000 characters.',
    );
  });

  it('translates watchlist codes, interpolating shared limit constants', () => {
    expect(translateValidationCode('watch_title_required', en)).toBe(
      'Please enter a title.',
    );
    expect(translateValidationCode('watch_title_too_long', en)).toBe(
      'Keep the title under 160 characters.',
    );
    expect(translateValidationCode('watch_url_invalid', bn)).toBe(
      'http(s):// দিয়ে পুরো লিংক লিখুন।',
    );
    expect(translateValidationCode('watch_rating_invalid', en)).toBe(
      'Rate 1 to 5 stars, or leave it unrated.',
    );
  });

  it('falls back to the generic error for unknown codes', () => {
    expect(translateValidationCode('mystery_code', en)).toBe(
      'Something went wrong. Please try again.',
    );
  });
});

describe('translateError', () => {
  it('maps the bill payment conflict to dedicated copy', () => {
    const error = new AppError('conflict', 'bill_has_payments');
    expect(translateError(error, en)).toBe(
      'This bill has recorded payments. Archive it instead of deleting.',
    );
    expect(translateError(error, bn)).toBe(
      'এই বিলে পরিশোধ লেখা আছে। মোছার বদলে আর্কাইভ করুন।',
    );
  });

  it('maps finance conflicts to dedicated copy', () => {
    expect(translateError(new AppError('conflict', 'account_in_use'), en)).toBe(
      'This account has recorded activity. Archive it instead of deleting.',
    );
    expect(translateError(new AppError('conflict', 'category_builtin'), bn)).toBe(
      'অন্তর্নির্মিত ক্যাটাগরির নাম বদলানো বা মোছা যায় না।',
    );
    expect(translateError(new AppError('conflict', 'budget_exists'), en)).toBe(
      'This category already has a budget — edit it instead.',
    );
    expect(translateError(new AppError('conflict', 'transaction_linked_to_bill'), en)).toBe(
      'This expense came from a bill payment. To change it, undo the payment on the bill.',
    );
  });

  it('uses the generic conflict copy for other conflict reasons', () => {
    const error = new AppError('conflict', 'something_else');
    expect(translateError(error, en)).toBe(
      'This change conflicts with another change. Please try again.',
    );
  });

  it('routes validation, not-found and database codes', () => {
    expect(translateError(new AppError('validation', 'bill_amount_invalid'), en)).toBe(
      'Enter an amount greater than zero, like 1250 or 1250.50.',
    );
    expect(translateError(new AppError('not_found', 'Whatever'), en)).toBe(
      'This item no longer exists.',
    );
    expect(translateError(new AppError('database', 'raw sql'), en)).toBe(
      'Could not access the database. Please try again.',
    );
  });

  it('falls back to the generic error for unknown throws', () => {
    expect(translateError(new Error('boom'), en)).toBe(
      'Something went wrong. Please try again.',
    );
    expect(translateError('not an error', en)).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
