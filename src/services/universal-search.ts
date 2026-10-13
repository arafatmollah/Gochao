import type { Ionicons } from '@expo/vector-icons';

import type { TranslateFn } from '@/i18n/translate';

/**
 * Universal search index: one box over commands (quick actions that run on
 * tap), features/settings (screens), while saved items and recent activity
 * come from SQLite in the search hook.
 *
 * Titles and hints are translated at build time; keywords are static and
 * deliberately bilingual so an English query still matches while the UI is
 * Bangla (and vice versa).
 */

export type SearchTargetKind = 'command' | 'feature' | 'setting';

export interface SearchTarget {
  id: string;
  kind: SearchTargetKind;
  title: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  keywords: string[];
}

interface TargetDef {
  id: SearchTarget['id'];
  kind: SearchTargetKind;
  titleKey: string;
  hintKey: string;
  icon: SearchTarget['icon'];
  keywords: string[];
}

const COMMANDS: TargetDef[] = [
  {
    id: 'add-task',
    kind: 'command',
    titleKey: 'dashboard.addTask',
    hintKey: 'tasks.title',
    icon: 'add',
    keywords: ['add', 'new', 'create', 'task', 'todo', 'kaj', 'natun', 'কাজ', 'নতুন'],
  },
  {
    id: 'add-income',
    kind: 'command',
    titleKey: 'finance.overview.addIncome',
    hintKey: 'finance.title',
    icon: 'arrow-down-circle-outline',
    keywords: ['add', 'income', 'earn', 'ay', 'আয়'],
  },
  {
    id: 'add-expense',
    kind: 'command',
    titleKey: 'finance.overview.addExpense',
    hintKey: 'finance.title',
    icon: 'arrow-up-circle-outline',
    keywords: ['add', 'expense', 'spend', 'kharach', 'khoroch', 'খরচ'],
  },
  {
    id: 'new-note',
    kind: 'command',
    titleKey: 'notes.addNote',
    hintKey: 'dashboard.notesTitle',
    icon: 'document-text-outline',
    keywords: ['add', 'new', 'note', 'write', 'not', 'নোট', 'নতুন'],
  },
  {
    id: 'add-bill',
    kind: 'command',
    titleKey: 'bills.form.add',
    hintKey: 'dashboard.upcomingBills',
    icon: 'receipt-outline',
    keywords: ['add', 'new', 'bill', 'payment', 'bil', 'বিল', 'নতুন'],
  },
  {
    id: 'add-request',
    kind: 'command',
    titleKey: 'family.requestForm.newTitle',
    hintKey: 'dashboard.familyTitle',
    icon: 'people-outline',
    keywords: ['add', 'new', 'request', 'family', 'onurodh', 'পরিবার', 'অনুরোধ'],
  },
  {
    id: 'new-grocery-list',
    kind: 'command',
    titleKey: 'grocery.addList',
    hintKey: 'more.groceryEntry',
    icon: 'cart-outline',
    keywords: ['add', 'new', 'grocery', 'bazar', 'list', 'বাজার', 'তালিকা'],
  },
  {
    id: 'check-updates',
    kind: 'command',
    titleKey: 'about.updateEntry',
    hintKey: 'about.updateEntryHint',
    icon: 'arrow-down-circle-outline',
    keywords: ['update', 'upgrade', 'apk', 'download', 'version', 'আপডেট'],
  },
];

const FEATURES: TargetDef[] = [
  {
    id: 'go-home',
    kind: 'feature',
    titleKey: 'nav.home',
    hintKey: 'dashboard.todayTasks',
    icon: 'home-outline',
    keywords: ['home', 'dashboard', 'main', 'হোম'],
  },
  {
    id: 'go-tasks',
    kind: 'feature',
    titleKey: 'nav.tasks',
    hintKey: 'tasks.title',
    icon: 'checkbox-outline',
    keywords: ['task', 'todo', 'kaj', 'কাজ'],
  },
  {
    id: 'go-bills',
    kind: 'feature',
    titleKey: 'nav.bills',
    hintKey: 'dashboard.upcomingBills',
    icon: 'receipt-outline',
    keywords: ['bill', 'payment', 'due', 'bil', 'বিল'],
  },
  {
    id: 'go-finance',
    kind: 'feature',
    titleKey: 'nav.finance',
    hintKey: 'dashboard.financeTitle',
    icon: 'wallet-outline',
    keywords: ['finance', 'money', 'taka', 'hisab', 'টাকা', 'হিসাব'],
  },
  {
    id: 'go-notes',
    kind: 'feature',
    titleKey: 'more.notesEntry',
    hintKey: 'more.notesEntryHint',
    icon: 'document-text-outline',
    keywords: ['note', 'not', 'নোট'],
  },
  {
    id: 'go-family',
    kind: 'feature',
    titleKey: 'more.familyEntry',
    hintKey: 'more.familyEntryHint',
    icon: 'people-outline',
    keywords: ['family', 'member', 'poribar', 'পরিবার'],
  },
  {
    id: 'go-grocery',
    kind: 'feature',
    titleKey: 'more.groceryEntry',
    hintKey: 'more.groceryEntryHint',
    icon: 'cart-outline',
    keywords: ['grocery', 'bazar', 'shopping', 'বাজার'],
  },
  {
    id: 'go-prayer',
    kind: 'feature',
    titleKey: 'more.prayerEntry',
    hintKey: 'more.prayerEntryHint',
    icon: 'moon-outline',
    keywords: ['prayer', 'namaz', 'salah', 'namaj', 'নামাজ'],
  },
  {
    id: 'go-health',
    kind: 'feature',
    titleKey: 'more.healthEntry',
    hintKey: 'more.healthEntryHint',
    icon: 'medkit-outline',
    keywords: ['health', 'medicine', 'doctor', 'sastho', 'oshudh', 'স্বাস্থ্য', 'ঔষধ'],
  },
  {
    id: 'go-entertainment',
    kind: 'feature',
    titleKey: 'more.entertainmentEntry',
    hintKey: 'more.entertainmentEntryHint',
    icon: 'film-outline',
    keywords: ['movie', 'watch', 'entertainment', 'binodon', 'সিনেমা', 'বিনোদন'],
  },
  {
    id: 'go-about',
    kind: 'feature',
    titleKey: 'more.aboutEntry',
    hintKey: 'more.aboutEntryHint',
    icon: 'information-circle-outline',
    keywords: ['about', 'info', 'সম্পর্কে'],
  },
];

const SETTINGS: TargetDef[] = [
  {
    id: 'go-prayer-settings',
    kind: 'setting',
    titleKey: 'prayer.settingsTitle',
    hintKey: 'prayer.methodLabel',
    icon: 'settings-outline',
    keywords: ['setting', 'prayer', 'method', 'location', 'reminder', 'notification', 'সেটিংস', 'নামাজ'],
  },
  {
    id: 'go-language',
    kind: 'setting',
    titleKey: 'more.languageTitle',
    hintKey: 'more.languageHint',
    icon: 'language-outline',
    keywords: ['language', 'bangla', 'english', 'bhasha', 'ভাষা', 'বাংলা'],
  },
  {
    id: 'go-terms',
    kind: 'setting',
    titleKey: 'about.termsTitle',
    hintKey: 'about.termsEntryHint',
    icon: 'document-text-outline',
    keywords: ['terms', 'conditions', 'শর্ত'],
  },
  {
    id: 'go-privacy',
    kind: 'setting',
    titleKey: 'about.privacyTitle',
    hintKey: 'about.privacyEntryHint',
    icon: 'shield-checkmark-outline',
    keywords: ['privacy', 'data', 'গোপনীয়তা'],
  },
];

/** Full static index, translated: commands first, then features, settings. */
export function buildSearchIndex(t: TranslateFn): SearchTarget[] {
  const build = (def: TargetDef): SearchTarget => ({
    id: def.id,
    kind: def.kind,
    title: t(def.titleKey),
    hint: t(def.hintKey),
    icon: def.icon,
    keywords: def.keywords,
  });
  return [...COMMANDS.map(build), ...FEATURES.map(build), ...SETTINGS.map(build)];
}

/**
 * Case-insensitive substring match: every query word must appear in the
 * title, hint, or keywords. Index order is preserved (commands surface
 * first). Empty queries match nothing — the screen shows recents instead.
 */
export function filterSearchIndex(
  index: SearchTarget[],
  query: string,
  limit = 8,
): SearchTarget[] {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [];
  }
  return index
    .filter((target) => {
      const haystack = `${target.title} ${target.hint} ${target.keywords.join(' ')}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    })
    .slice(0, limit);
}
