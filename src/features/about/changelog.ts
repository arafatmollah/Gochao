/**
 * Version changelog: one entry per shipped version, newest last. Each entry
 * points at a locale highlights string, so release notes stay translated.
 * When cutting a release, append the version here AND add its
 * `about.v<Key>highlights` strings to `en.json`/`bn.json`.
 */

export interface ChangelogEntry {
  version: string;
  /** Locale key holding the bullet highlights, e.g. `about.v100highlights`. */
  highlightsKey: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  { version: '1.0.0', highlightsKey: 'about.v100highlights' },
];

/** Entries newer than `version` (semantic dot-part compare), oldest first. */
export function entriesNewerThan(version: string | null, compare: (a: string, b: string) => number): ChangelogEntry[] {
  if (version === null) {
    return [];
  }
  return CHANGELOG.filter((entry) => compare(entry.version, version) > 0);
}
