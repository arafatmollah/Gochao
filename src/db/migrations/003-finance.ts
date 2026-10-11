import type { Migration } from './types';

/**
 * 003 — Accounts, categories, and transactions (income / expense).
 *
 * Numbering note: the product plan's suggested sequence (master prompt §6)
 * lists "002 notes and categories" and "003 accounts and transactions".
 * Notes are not built yet, so the category table lands here with the finance
 * schema it serves; bills took 002 (see `002-bills.ts`). Migrations are
 * contiguous and forward-only.
 *
 * Model decisions:
 *
 * - Amounts are integer minor units (poisha) everywhere. `amount_minor > 0`;
 *   the transaction `kind` carries the sign. Floats are never stored.
 * - Transfers are NOT rows in `transactions` — they get their own table in
 *   migration 004, so a transfer can never be counted as income or expense
 *   (engineering rule 11) by construction.
 * - `bill_occurrence_id` links an expense to the bill payment that created
 *   it. UNIQUE makes "one expense per bill payment" a structural invariant —
 *   duplicate creation is impossible even under retries (Module E).
 * - Categories are seeded with stable IDs for the built-in income/expense
 *   lists from the master prompt (Module D). The UI translates built-in ids
 *   (`categories.<id>`); custom categories display their stored name.
 *   `sort_order` keeps the natural picker order (customs sort last).
 * - Accounts are referenced with ON DELETE RESTRICT: an account with any
 *   transaction history cannot be deleted at the SQL level; the service
 *   offers archive instead (engineering rule 10).
 */
export const migration003: Migration = {
  version: 3,
  name: 'finance',
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'mfs', 'savings', 'other')),
        currency TEXT NOT NULL DEFAULT 'BDT' CHECK (length(trim(currency)) > 0),
        opening_balance_minor INTEGER NOT NULL DEFAULT 0
          CHECK (opening_balance_minor >= 0),
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX idx_accounts_name ON accounts (name COLLATE NOCASE);
      CREATE INDEX idx_accounts_archived ON accounts (is_archived);

      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        is_builtin INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0, 1)),
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 999,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX idx_categories_kind_name
        ON categories (kind, name COLLATE NOCASE);
      CREATE INDEX idx_categories_kind_archived
        ON categories (kind, is_archived);

      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        occurred_on TEXT NOT NULL CHECK (
          occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        description TEXT NOT NULL CHECK (length(trim(description)) > 0),
        recipient TEXT,
        notes TEXT,
        bill_occurrence_id TEXT UNIQUE
          REFERENCES bill_occurrences(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_transactions_occurred_on ON transactions (occurred_on);
      CREATE INDEX idx_transactions_account_occurred
        ON transactions (account_id, occurred_on);
      CREATE INDEX idx_transactions_category_occurred
        ON transactions (category_id, occurred_on);
    `);

    // Built-in categories (master prompt Module D lists). Stable IDs are the
    // display keys; the stored name is the English fallback. Seeded with
    // SQLite's clock so installs carry real timestamps.
    const seeds: [string, string, string, number][] = [
      // [id, kind, name, sort_order]
      ['cat_income_salary', 'income', 'Salary', 1],
      ['cat_income_freelance', 'income', 'Freelance income', 2],
      ['cat_income_business', 'income', 'Business income', 3],
      ['cat_income_gift', 'income', 'Gifts', 4],
      ['cat_income_refund', 'income', 'Refunds', 5],
      ['cat_income_other', 'income', 'Other income', 6],
      ['cat_expense_food', 'expense', 'Food', 1],
      ['cat_expense_groceries', 'expense', 'Groceries', 2],
      ['cat_expense_transport', 'expense', 'Transport', 3],
      ['cat_expense_rent', 'expense', 'Rent', 4],
      ['cat_expense_utilities', 'expense', 'Utilities', 5],
      ['cat_expense_healthcare', 'expense', 'Healthcare', 6],
      ['cat_expense_medicine', 'expense', 'Medicine', 7],
      ['cat_expense_education', 'expense', 'Education', 8],
      ['cat_expense_family', 'expense', 'Family expenses', 9],
      ['cat_expense_shopping', 'expense', 'Shopping', 10],
      ['cat_expense_subscriptions', 'expense', 'Subscriptions', 11],
      ['cat_expense_entertainment', 'expense', 'Entertainment', 12],
      ['cat_expense_other', 'expense', 'Other expenses', 13],
    ];
    for (const [id, kind, name, sortOrder] of seeds) {
      await db.runAsync(
        `INSERT INTO categories
           (id, kind, name, is_builtin, is_archived, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, 1, 0, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        [id, kind, name, sortOrder],
      );
    }
  },
};
