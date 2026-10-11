import { MIGRATIONS, type Migration } from './migrations';
import type { SqlDatabase } from './sql';

export function currentSchemaVersion(): number {
  return MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);
}

function assertMigrationListIsValid(migrations: readonly Migration[]): void {
  const seen = new Set<number>();
  let previous = 0;
  for (const migration of migrations) {
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version ${migration.version}`);
    }
    if (migration.version <= previous) {
      throw new Error('Migrations must be ordered by increasing version');
    }
    seen.add(migration.version);
    previous = migration.version;
  }
}

export async function getUserVersion(db: SqlDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Applies all pending migrations in order, each inside its own exclusive
 * transaction so that a failed migration rolls back completely and leaves
 * `user_version` untouched. Returns the resulting schema version.
 */
export async function runMigrations(
  db: SqlDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  assertMigrationListIsValid(migrations);

  let version = await getUserVersion(db);
  const pending = [...migrations]
    .filter((m) => m.version > version)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await migration.up(txn);
      // PRAGMA does not accept bound parameters; version is a validated
      // integer constant from our own migration list, never user input.
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    version = migration.version;
  }

  return version;
}
