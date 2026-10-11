/**
 * Test adapter: binds the app's `SqlDatabase` interface to Node's built-in
 * SQLite (node:sqlite). The exact same SQL that runs on-device via
 * expo-sqlite runs here against a real SQLite engine, so migrations and
 * repository queries are genuinely exercised, not mocked.
 */
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '@/db/migrate';
import type { SqlDatabase, SqlParam } from '@/db/sql';

export interface TestDatabase extends SqlDatabase {
  close(): void;
}

export function createNodeSqliteDatabase(path = ':memory:'): TestDatabase {
  const db = new DatabaseSync(path);

  const adapter: SqlDatabase = {
    execAsync: async (source) => {
      db.exec(source);
    },
    runAsync: async (source, params = []) => {
      const result = db.prepare(source).run(...(params as never[]));
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    getAllAsync: async <T>(source: string, params: SqlParam[] = []) =>
      db.prepare(source).all(...(params as never[])) as T[],
    getFirstAsync: async <T>(source: string, params: SqlParam[] = []) => {
      const row = db.prepare(source).get(...(params as never[]));
      return (row ?? null) as T | null;
    },
    withExclusiveTransactionAsync: async (task) => {
      db.exec('BEGIN IMMEDIATE');
      try {
        await task(adapter);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return {
    ...adapter,
    close: () => db.close(),
  };
}

/** Mirrors the production connection setup (foreign keys enforced per connection). */
export async function createMigratedDatabase(path = ':memory:'): Promise<TestDatabase> {
  const db = createNodeSqliteDatabase(path);
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}
