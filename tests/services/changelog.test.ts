import { CHANGELOG, entriesNewerThan } from '@/features/about/changelog';
import { compareVersions } from '@/services/app-update';

describe('changelog', () => {
  it('lists shipped versions oldest first', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
    expect(CHANGELOG[0].version).toBe('1.0.0');
    for (const entry of CHANGELOG) {
      expect(entry.highlightsKey).toMatch(/^about\./);
    }
  });

  it('finds entries newer than the seen version', () => {
    expect(entriesNewerThan(null, compareVersions)).toEqual([]);
    expect(entriesNewerThan('1.0.0', compareVersions)).toEqual([]);
    expect(entriesNewerThan('0.9.0', compareVersions).map((entry) => entry.version)).toEqual([
      '1.0.0',
    ]);
  });
});
