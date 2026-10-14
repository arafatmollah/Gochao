import en from '@/i18n/locales/en.json';
import { createTranslator, type TranslationDict } from '@/i18n/translate';
import { buildSearchIndex, filterSearchIndex } from '@/services/universal-search';

const dict = en as TranslationDict;
const t = createTranslator('en', dict, dict);

describe('universal search index', () => {
  it('builds translated commands, features, and settings', () => {
    const index = buildSearchIndex(t);

    expect(index.length).toBeGreaterThan(15);
    expect(index.filter((target) => target.kind === 'command').length).toBeGreaterThan(5);
    // Commands surface before features and settings.
    const firstFeature = index.findIndex((target) => target.kind === 'feature');
    const lastCommand = index
      .map((target) => target.kind)
      .lastIndexOf('command');
    expect(lastCommand).toBeLessThan(firstFeature);
  });

  it('resolves every title and hint to a real translation', () => {
    const index = buildSearchIndex(t);

    for (const target of index) {
      expect(target.title).toBeTruthy();
      expect(target.hint).toBeTruthy();
      // A missing key degrades to its raw dot-path — none should leak through.
      expect(target.title).not.toMatch(/^[a-z][\w]*(\.[\w]+)+$/);
      expect(target.hint).not.toMatch(/^[a-z][\w]*(\.[\w]+)+$/);
    }
  });

  it('matches commands by typed keywords', () => {
    const index = buildSearchIndex(t);

    const ids = filterSearchIndex(index, 'add').map((target) => target.id);
    expect(ids).toContain('add-task');
    expect(ids).toContain('add-income');
    expect(ids).toContain('add-expense');
  });

  it('matches features by name in either language', () => {
    const index = buildSearchIndex(t);

    expect(filterSearchIndex(index, 'prayer').map((target) => target.id)).toContain('go-prayer');
    expect(filterSearchIndex(index, 'নামাজ').map((target) => target.id)).toContain('go-prayer');
    expect(filterSearchIndex(index, 'টাকা').map((target) => target.id)).toContain('go-finance');
  });

  it('requires every word to match and returns nothing for empty queries', () => {
    const index = buildSearchIndex(t);

    expect(filterSearchIndex(index, '')).toEqual([]);
    expect(filterSearchIndex(index, '   ')).toEqual([]);
    expect(filterSearchIndex(index, 'add zebra').map((target) => target.id)).not.toContain(
      'add-task',
    );
    expect(
      filterSearchIndex(index, 'APP UPDATE').map((target) => target.id),
    ).toContain('check-updates');
    expect(filterSearchIndex(index, 'backup').map((target) => target.id)).toContain('go-backup');
    expect(filterSearchIndex(index, 'bug').map((target) => target.id)).toContain('go-feedback');
  });
});
