import { nowIso } from '@/utils/time';

import type { SqlDatabase } from '../sql';

/** Key under which the language preference lives in `app_settings`. */
export const LANGUAGE_SETTING_KEY = 'language';

export interface SettingsRepository {
  get(key: string): Promise<string | null>;
  /** Inserts or replaces a setting. */
  set(key: string, value: string): Promise<void>;
}

interface SettingRow {
  value: string;
}

export class SqliteSettingsRepository implements SettingsRepository {
  constructor(
    private readonly db: SqlDatabase,
    private readonly now: () => string = nowIso,
  ) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<SettingRow>(
      'SELECT value FROM app_settings WHERE key = ?',
      [key],
    );
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, this.now()],
    );
  }
}
