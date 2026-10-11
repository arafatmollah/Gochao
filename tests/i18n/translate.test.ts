import bnDict from '@/i18n/locales/bn.json';
import enDict from '@/i18n/locales/en.json';
import {
  createTranslator,
  formatNumber,
  interpolate,
  isLocale,
  lookupKey,
  parseLocale,
  toLocaleDigits,
  type TranslationDict,
} from '@/i18n/translate';

/** Collects every leaf key path so the two locales can be compared. */
function collectPaths(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') {
    return [prefix];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => collectPaths(item, `${prefix}.${index}`));
  }
  if (typeof node === 'object' && node !== null) {
    return Object.entries(node).flatMap(([key, value]) =>
      collectPaths(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

describe('dictionary integrity', () => {
  it('bn and en define exactly the same key paths', () => {
    const enPaths = collectPaths(enDict).sort();
    const bnPaths = collectPaths(bnDict).sort();
    expect(bnPaths).toEqual(enPaths);
  });

  it('has 12 months and 7 weekdays in both locales', () => {
    for (const dict of [enDict, bnDict] as TranslationDict[]) {
      const dates = dict.dates as { months: string[]; weekdays: string[] };
      expect(dates.months).toHaveLength(12);
      expect(dates.weekdays).toHaveLength(7);
    }
  });
});

describe('lookupKey', () => {
  it('resolves nested keys and array indices', () => {
    const en = enDict as TranslationDict;
    expect(lookupKey(en, 'dates.months.9')).toBe('October');
    expect(lookupKey(en, 'tasks.sections.no-date')).toBe('No due date');
    expect(lookupKey(en, 'dates.months.12')).toBeNull();
    expect(lookupKey(en, 'missing.path')).toBeNull();
  });
});

describe('toLocaleDigits', () => {
  it('maps ASCII digits for bn and leaves en untouched', () => {
    expect(toLocaleDigits('2026-10-11', 'bn')).toBe('২০২৬-১০-১১');
    expect(toLocaleDigits('2026-10-11', 'en')).toBe('2026-10-11');
  });
});

describe('formatNumber', () => {
  it('groups thousands and maps digits per locale', () => {
    expect(formatNumber(70450, 'en')).toBe('70,450');
    expect(formatNumber(70450, 'bn')).toBe('৭০,৪৫০');
    expect(formatNumber(7, 'bn')).toBe('৭');
    expect(formatNumber(0, 'en')).toBe('0');
  });

  it('rounds to whole numbers and keeps the sign', () => {
    expect(formatNumber(0.4, 'en')).toBe('0');
    expect(formatNumber(1234.6, 'en')).toBe('1,235');
    expect(formatNumber(-1000, 'en')).toBe('-1,000');
  });
});

describe('interpolate', () => {
  it('localizes numeric params as digits without grouping', () => {
    expect(interpolate('{{year}}', { year: 2026 }, 'bn')).toBe('২০২৬');
    expect(interpolate('{{count}} items', { count: 1234 }, 'bn')).toBe('১২৩৪ items');
    expect(interpolate('{{count}} items', { count: 1234 }, 'en')).toBe('1234 items');
  });

  it('leaves unknown placeholders and param-less templates untouched', () => {
    expect(interpolate('Hi {{name}}', {}, 'en')).toBe('Hi {{name}}');
    expect(interpolate('no params', undefined, 'en')).toBe('no params');
  });
});

describe('locale parsing', () => {
  it('accepts supported codes and rejects everything else', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('bn')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(parseLocale('bn')).toBe('bn');
    expect(parseLocale('fr')).toBeNull();
    expect(parseLocale(null)).toBeNull();
    expect(parseLocale(undefined)).toBeNull();
  });
});

describe('createTranslator', () => {
  const en = createTranslator('en', enDict as TranslationDict, enDict as TranslationDict);
  const bn = createTranslator('bn', bnDict as TranslationDict, enDict as TranslationDict);

  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('translates per locale', () => {
    expect(en('dates.today')).toBe('Today');
    expect(bn('dates.today')).toBe('আজ');
  });

  it('resolves plural keys via _one/_other with localized digits', () => {
    expect(en('tasks.activeCount', { count: 1 })).toBe('1 task active');
    expect(en('tasks.activeCount', { count: 5 })).toBe('5 tasks active');
    expect(bn('tasks.activeCount', { count: 5 })).toBe('৫ টি কাজ চলমান');
  });

  it('interpolates non-count params in both locales', () => {
    expect(en('validation.title_too_long', { max: 140 })).toBe(
      'Keep the title under 140 characters.',
    );
    expect(bn('validation.title_too_long', { max: 140 })).toBe(
      'নাম ১৪০ অক্ষরের মধ্যে রাখুন।',
    );
  });

  it('falls back to English for keys missing in the active locale', () => {
    const sparse = createTranslator('bn', { dates: { today: 'আজ' } }, enDict as TranslationDict);
    expect(sparse('dates.today')).toBe('আজ');
    expect(sparse('dates.tomorrow')).toBe('Tomorrow');
  });

  it('returns the key itself when no dictionary has it', () => {
    expect(en('totally.missing.key')).toBe('totally.missing.key');
  });
});
