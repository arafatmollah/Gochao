import {
  defaultPrayerSettings,
  SqlitePrayerRepository,
} from '@/db/repositories/prayer-repository';
import type { PrayerSettings } from '@/types/prayer';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

let db: TestDatabase;
let repo: SqlitePrayerRepository;

const T0 = '2026-10-01T08:00:00.000Z';

function makeSettings(overrides: Partial<PrayerSettings> = {}): PrayerSettings {
  return {
    ...defaultPrayerSettings(),
    cityLabel: 'Dhaka',
    updatedAt: T0,
    ...overrides,
  };
}

const FINGERPRINT = {
  calcMethod: 'karachi',
  madhab: 'hanafi',
  latitude: 23.8103,
  longitude: 90.4125,
};

const TIMES = [
  { prayer: 'fajr', time: '04:45' },
  { prayer: 'dhuhr', time: '12:00' },
  { prayer: 'asr', time: '15:30' },
  { prayer: 'maghrib', time: '18:10' },
  { prayer: 'isha', time: '19:30' },
] as const;

beforeEach(async () => {
  db = await createMigratedDatabase();
  repo = new SqlitePrayerRepository(db);
});

afterEach(() => {
  db.close();
});

describe('PrayerRepository settings', () => {
  it('returns null before the first save', async () => {
    expect(await repo.findSettings()).toBeNull();
  });

  it('upserts the singleton settings row', async () => {
    await repo.upsertSettings(makeSettings());
    expect(await repo.findSettings()).toEqual(makeSettings());

    await repo.upsertSettings(makeSettings({ calculationMethod: 'egyptian', cityLabel: 'Cumilla' }));
    const loaded = await repo.findSettings();
    expect(loaded?.calculationMethod).toBe('egyptian');
    expect(loaded?.cityLabel).toBe('Cumilla');

    const count = await db.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM prayer_settings',
    );
    expect(count?.total).toBe(1);
  });
});

describe('PrayerRepository day times', () => {
  it('replaces a day atomically and reads prayers in order', async () => {
    await repo.replaceDayTimes('2026-10-12', [...TIMES], FINGERPRINT, T0);

    const loaded = await repo.listDayTimes('2026-10-12');
    expect(loaded.map((row) => row.prayer)).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
    expect(loaded[0]).toMatchObject({ time: '04:45', ...FINGERPRINT });
    expect(await repo.listDayTimes('2026-10-13')).toHaveLength(0);
  });

  it('replaces stale fingerprints for the same day', async () => {
    await repo.replaceDayTimes('2026-10-12', [...TIMES], FINGERPRINT, T0);
    await repo.replaceDayTimes(
      '2026-10-12',
      [...TIMES].map((entry) =>
        entry.prayer === 'fajr' ? { ...entry, time: '04:50' } : entry,
      ),
      { ...FINGERPRINT, calcMethod: 'egyptian' },
      T0,
    );

    const loaded = await repo.listDayTimes('2026-10-12');
    expect(loaded).toHaveLength(5);
    expect(loaded[0]).toMatchObject({ time: '04:50', calcMethod: 'egyptian' });
  });

  it('prunes cached days before a cutoff', async () => {
    await repo.replaceDayTimes('2026-08-01', [...TIMES], FINGERPRINT, T0);
    await repo.replaceDayTimes('2026-10-12', [...TIMES], FINGERPRINT, T0);

    await repo.deleteTimesBefore('2026-10-12');
    expect(await repo.listDayTimes('2026-08-01')).toHaveLength(0);
    expect(await repo.listDayTimes('2026-10-12')).toHaveLength(5);
  });
});

describe('PrayerRepository logs', () => {
  it('upserts one log per prayer per day', async () => {
    await repo.upsertLog({
      date: '2026-10-12',
      prayer: 'fajr',
      status: 'prayed',
      loggedAt: T0,
      updatedAt: T0,
    });
    await repo.upsertLog({
      date: '2026-10-12',
      prayer: 'fajr',
      status: 'missed',
      loggedAt: T0,
      updatedAt: T0,
    });

    const logs = await repo.listLogs('2026-10-12', '2026-10-12');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ date: '2026-10-12', prayer: 'fajr', status: 'missed' });
  });

  it('lists a date range ordered by date then prayer', async () => {
    await repo.upsertLog({ date: '2026-10-12', prayer: 'isha', status: 'prayed', loggedAt: T0, updatedAt: T0 });
    await repo.upsertLog({ date: '2026-10-11', prayer: 'fajr', status: 'missed', loggedAt: T0, updatedAt: T0 });
    await repo.upsertLog({ date: '2026-10-12', prayer: 'fajr', status: 'prayed', loggedAt: T0, updatedAt: T0 });

    const logs = await repo.listLogs('2026-10-11', '2026-10-12');
    expect(logs.map((log) => `${log.date} ${log.prayer}`)).toEqual([
      '2026-10-11 fajr',
      '2026-10-12 fajr',
      '2026-10-12 isha',
    ]);
  });

  it('deletes a log and reports whether one existed', async () => {
    await repo.upsertLog({ date: '2026-10-12', prayer: 'fajr', status: 'prayed', loggedAt: T0, updatedAt: T0 });

    expect(await repo.deleteLog('2026-10-12', 'fajr')).toBe(true);
    expect(await repo.listLogs('2026-10-12', '2026-10-12')).toHaveLength(0);
    expect(await repo.deleteLog('2026-10-12', 'fajr')).toBe(false);
  });
});
