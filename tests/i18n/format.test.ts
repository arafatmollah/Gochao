import {
  formatIsoDateDisplay,
  formatIsoDateRelative,
  formatIsoDateWeekday,
  formatMoney,
  greetingKeyForHour,
} from '@/i18n/format';
import bnDict from '@/i18n/locales/bn.json';
import enDict from '@/i18n/locales/en.json';
import { createTranslator } from '@/i18n/translate';

const en = createTranslator('en', enDict, enDict);
const bn = createTranslator('bn', bnDict, enDict);

describe('formatMoney', () => {
  it('formats whole taka without a poisha part', () => {
    expect(formatMoney(125000, 'en')).toBe('৳1,250');
    expect(formatMoney(125000, 'bn')).toBe('৳১,২৫০');
    expect(formatMoney(0, 'en')).toBe('৳0');
  });

  it('shows the poisha part when non-zero, always two digits', () => {
    expect(formatMoney(125050, 'en')).toBe('৳1,250.50');
    expect(formatMoney(125005, 'en')).toBe('৳1,250.05');
    expect(formatMoney(125050, 'bn')).toBe('৳১,২৫০.৫০');
  });

  it('groups large amounts and handles negatives', () => {
    expect(formatMoney(1234567890, 'en')).toBe('৳12,345,678.90');
    expect(formatMoney(-125000, 'en')).toBe('-৳1,250');
    expect(formatMoney(-125050, 'bn')).toBe('-৳১,২৫০.৫০');
  });
});

describe('date display formatting', () => {
  it('renders the long date per locale', () => {
    expect(formatIsoDateDisplay('2026-10-11', en)).toBe('October 11, 2026');
    expect(formatIsoDateDisplay('2026-10-11', bn)).toBe('১১ অক্টোবর ২০২৬');
  });

  it('returns the raw value for unparseable input', () => {
    expect(formatIsoDateDisplay('not-a-date', en)).toBe('not-a-date');
    expect(formatIsoDateWeekday('not-a-date', en)).toBe('not-a-date');
  });

  it('names the weekday and date', () => {
    expect(formatIsoDateWeekday('2026-10-11', en)).toBe('Sunday, 11 October');
    expect(formatIsoDateWeekday('2026-10-11', bn)).toBe('রবিবার, ১১ অক্টোবর');
  });

  it('uses relative names around today', () => {
    const today = '2026-10-11';
    expect(formatIsoDateRelative(today, today, en)).toBe('Today');
    expect(formatIsoDateRelative('2026-10-12', today, en)).toBe('Tomorrow');
    expect(formatIsoDateRelative('2026-10-10', today, en)).toBe('Yesterday');
    expect(formatIsoDateRelative('2026-10-20', today, en)).toBe('October 20, 2026');
    expect(formatIsoDateRelative(today, today, bn)).toBe('আজ');
  });
});

describe('greetingKeyForHour', () => {
  it('maps morning, afternoon and evening hour ranges', () => {
    expect(greetingKeyForHour(4)).toBe('dashboard.greetingMorning');
    expect(greetingKeyForHour(11)).toBe('dashboard.greetingMorning');
    expect(greetingKeyForHour(12)).toBe('dashboard.greetingAfternoon');
    expect(greetingKeyForHour(17)).toBe('dashboard.greetingAfternoon');
    expect(greetingKeyForHour(18)).toBe('dashboard.greetingEvening');
    expect(greetingKeyForHour(23)).toBe('dashboard.greetingEvening');
    expect(greetingKeyForHour(0)).toBe('dashboard.greetingEvening');
    expect(greetingKeyForHour(3)).toBe('dashboard.greetingEvening');
  });
});
