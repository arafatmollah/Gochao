import type { SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrate';
import { toSqlDatabase } from './sqlite-adapter';

export const DATABASE_NAME = 'jibon.db';

/**
 * Called once per database open from `SQLiteProvider.onInit`.
 *
 * WAL journaling is the standard SQLite choice for mobile apps: concurrent
 * reads while writing with good crash safety. Foreign keys are enforced per
 * connection, so this runs on every open, not only on first install.
 */
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);
  await runMigrations(toSqlDatabase(db));
}
