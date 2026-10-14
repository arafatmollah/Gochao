import { MIGRATIONS } from '@/db/migrations';
import type { Migration } from '@/db/migrations';
import { currentSchemaVersion, getUserVersion, runMigrations } from '@/db/migrate';

import { createNodeSqliteDatabase } from '../helpers/node-sqlite-database';

describe('migration runner', () => {
  it('applies all migrations on a fresh database and records the schema version', async () => {
    const db = createNodeSqliteDatabase();

    expect(await getUserVersion(db)).toBe(0);
    const version = await runMigrations(db);

    expect(version).toBe(currentSchemaVersion());
    expect(version).toBeGreaterThan(0);
    expect(await getUserVersion(db)).toBe(version);

    const tables = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );
    const names = tables.map((t) => t.name);
    expect(names).toContain('app_settings');
    expect(names).toContain('tasks');
    expect(names).toContain('bills');
    expect(names).toContain('bill_occurrences');
    expect(names).toContain('accounts');
    expect(names).toContain('categories');
    expect(names).toContain('transactions');
    expect(names).toContain('transfers');
    expect(names).toContain('budgets');
    expect(names).toContain('grocery_lists');
    expect(names).toContain('grocery_items');
    expect(names).toContain('prayer_settings');
    expect(names).toContain('prayer_day_times');
    expect(names).toContain('prayer_logs');
    expect(names).toContain('medicines');
    expect(names).toContain('medicine_schedules');
    expect(names).toContain('medicine_logs');
    expect(names).toContain('appointments');
    expect(names).toContain('health_records');
    expect(names).toContain('watchlist_items');
    expect(names).toContain('entertainment_media');
    expect(names).toContain('entertainment_episodes');
    expect(names).toContain('entertainment_notified_events');

    const prayerColumns = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM pragma_table_info('prayer_settings')`,
    );
    expect(prayerColumns.map((column) => column.name)).toContain('reminders_enabled');
    expect(prayerColumns.map((column) => column.name)).toContain('utc_offset_minutes');

    const watchlistColumns = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM pragma_table_info('watchlist_items')`,
    );
    expect(watchlistColumns.map((column) => column.name)).toContain('source');

    const indexes = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name`,
    );
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('idx_tasks_status_due_at');
    expect(indexNames).toContain('idx_tasks_parent_task_id');
    expect(indexNames).toContain('idx_bills_archived');
    expect(indexNames).toContain('idx_bill_occurrences_status_due');
    expect(indexNames).toContain('idx_bill_occurrences_bill_due');
    expect(indexNames).toContain('idx_accounts_name');
    expect(indexNames).toContain('idx_accounts_archived');
    expect(indexNames).toContain('idx_categories_kind_name');
    expect(indexNames).toContain('idx_categories_kind_archived');
    expect(indexNames).toContain('idx_transactions_occurred_on');
    expect(indexNames).toContain('idx_transactions_account_occurred');
    expect(indexNames).toContain('idx_transactions_category_occurred');
    expect(indexNames).toContain('idx_transfers_from_occurred');
    expect(indexNames).toContain('idx_transfers_to_occurred');
    expect(indexNames).toContain('idx_transfers_occurred_on');
    expect(indexNames).toContain('idx_grocery_lists_archived_updated');
    expect(indexNames).toContain('idx_grocery_items_list');
    expect(indexNames).toContain('idx_grocery_items_member');
    expect(indexNames).toContain('idx_prayer_day_times_date');
    expect(indexNames).toContain('idx_prayer_logs_date');
    expect(indexNames).toContain('idx_medicines_archived_name');
    expect(indexNames).toContain('idx_medicine_schedules_medicine');
    expect(indexNames).toContain('idx_medicine_logs_date');
    expect(indexNames).toContain('idx_appointments_date');
    expect(indexNames).toContain('idx_health_records_recorded_on');
    expect(indexNames).toContain('idx_watchlist_status_updated');
    expect(indexNames).toContain('idx_watchlist_kind');

    db.close();
  });

  it('seeds the built-in income and expense categories exactly once', async () => {
    const db = createNodeSqliteDatabase();
    await runMigrations(db);

    const counts = await db.getFirstAsync<{ income: number; expense: number; builtin: number }>(
      `SELECT
         SUM(CASE WHEN kind = 'income' THEN 1 ELSE 0 END) AS income,
         SUM(CASE WHEN kind = 'expense' THEN 1 ELSE 0 END) AS expense,
         SUM(is_builtin) AS builtin
       FROM categories`,
    );
    expect(counts).toEqual({ income: 6, expense: 13, builtin: 19 });

    const salary = await db.getFirstAsync<{ name: string; is_builtin: number }>(
      `SELECT name, is_builtin FROM categories WHERE id = 'cat_income_salary'`,
    );
    expect(salary).toEqual({ name: 'Salary', is_builtin: 1 });

    // Re-running migrations must not duplicate the seeds.
    await runMigrations(db);
    const total = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM categories`,
    );
    expect(total?.count).toBe(19);

    db.close();
  });

  it('is idempotent: running again leaves the version unchanged and applies nothing', async () => {
    const db = createNodeSqliteDatabase();

    const first = await runMigrations(db);
    const second = await runMigrations(db);

    expect(second).toBe(first);
    db.close();
  });

  it('rolls back a failing migration and does not advance the version', async () => {
    const db = createNodeSqliteDatabase();

    const broken: Migration[] = [
      {
        version: 1,
        name: 'create-widgets',
        up: async (txn) => {
          await txn.execAsync('CREATE TABLE widgets (id TEXT PRIMARY KEY);');
        },
      },
      {
        version: 2,
        name: 'broken-migration',
        up: async (txn) => {
          await txn.execAsync('CREATE TABLE gadgets (id TEXT PRIMARY KEY);');
          throw new Error('boom');
        },
      },
    ];

    await expect(runMigrations(db, broken)).rejects.toThrow('boom');

    expect(await getUserVersion(db)).toBe(1);

    const tables = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table'`,
    );
    const names = tables.map((t) => t.name);
    expect(names).toContain('widgets');
    expect(names).not.toContain('gadgets');

    db.close();
  });

  it('rejects duplicate or unordered migration versions', async () => {
    const db = createNodeSqliteDatabase();
    const invalid: Migration[] = [
      { version: 2, name: 'second', up: async () => {} },
      { version: 2, name: 'duplicate', up: async () => {} },
    ];
    await expect(runMigrations(db, invalid)).rejects.toThrow(/Duplicate migration version/);
    db.close();
  });

  it('has a contiguous migration list starting at version 1', () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual(versions.map((_, index) => index + 1));
  });
});
