import type { Migration } from './types';

/**
 * 004 — Transfers and budgets.
 *
 * Model decisions:
 *
 * - A transfer is a single row (not two transaction rows). Money moving
 *   between the user's own accounts is therefore structurally excluded from
 *   income/expense sums, exactly as engineering rule 11 requires, and both
 *   sides of the move are updated by writing one row — atomic by nature.
 *   CHECK (from <> to) forbids self-transfers at the schema level.
 * - Budgets are monthly by definition (master prompt Module D: "monthly
 *   budgets by category"), so there is no period column: one budget row per
 *   expense category, UNIQUE(category_id). Usage is derived from stored
 *   transactions at query time, never stored.
 * - ON DELETE RESTRICT keeps history safe: a category with a budget (or an
 *   account in a transfer) cannot be deleted silently.
 */
export const migration004: Migration = {
  version: 4,
  name: 'transfers_budgets',
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE transfers (
        id TEXT PRIMARY KEY,
        from_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        to_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        occurred_on TEXT NOT NULL CHECK (
          occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (from_account_id <> to_account_id)
      );

      CREATE INDEX idx_transfers_from_occurred
        ON transfers (from_account_id, occurred_on);
      CREATE INDEX idx_transfers_to_occurred
        ON transfers (to_account_id, occurred_on);
      CREATE INDEX idx_transfers_occurred_on ON transfers (occurred_on);

      CREATE TABLE budgets (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL UNIQUE REFERENCES categories(id) ON DELETE RESTRICT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
