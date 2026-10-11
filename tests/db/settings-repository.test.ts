import {
  LANGUAGE_SETTING_KEY,
  SqliteSettingsRepository,
} from '@/db/repositories/settings-repository';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

describe('SqliteSettingsRepository', () => {
  let db: TestDatabase;
  let clock: string;
  let repo: SqliteSettingsRepository;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    clock = '2026-10-11T08:00:00.000Z';
    repo = new SqliteSettingsRepository(db, () => clock);
  });

  afterEach(() => {
    db.close();
  });

  it('returns null for a missing key', async () => {
    expect(await repo.get(LANGUAGE_SETTING_KEY)).toBeNull();
  });

  it('stores and reads a value', async () => {
    await repo.set(LANGUAGE_SETTING_KEY, 'bn');
    expect(await repo.get(LANGUAGE_SETTING_KEY)).toBe('bn');
  });

  it('upserts: the latest value wins and lands in a single row', async () => {
    await repo.set(LANGUAGE_SETTING_KEY, 'en');
    clock = '2026-10-12T09:30:00.000Z';
    await repo.set(LANGUAGE_SETTING_KEY, 'bn');

    expect(await repo.get(LANGUAGE_SETTING_KEY)).toBe('bn');

    const row = await db.getFirstAsync<{ n: number; updated_at: string }>(
      'SELECT COUNT(*) AS n, MAX(updated_at) AS updated_at FROM app_settings',
    );
    expect(row?.n).toBe(1);
    expect(row?.updated_at).toBe('2026-10-12T09:30:00.000Z');
  });

  it('reads the persisted value through a fresh repository instance', async () => {
    await repo.set(LANGUAGE_SETTING_KEY, 'bn');
    const fresh = new SqliteSettingsRepository(db);
    expect(await fresh.get(LANGUAGE_SETTING_KEY)).toBe('bn');
  });
});
