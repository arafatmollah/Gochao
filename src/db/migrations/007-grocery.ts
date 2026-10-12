import type { Migration } from './types';

/**
 * 007 — Grocery lists and items (master prompt Module G / Phase 7).
 *
 * Model decisions:
 *
 * - Lists are the shopping-trip aggregate; items belong to exactly one list
 *   and are deleted with it (ON DELETE CASCADE). A list is never deleted to
 *   "finish" shopping — it is archived (`is_archived`), so archived lists
 *   are the completed-shopping history required by the master prompt.
 * - Money follows the app-wide rule: INTEGER minor units (poisha), never
 *   floats. `estimated_price_minor` is planning data only and is never
 *   treated as an expense; `actual_price_minor` records what was really paid.
 *   No finance transaction is created here (that is a later phase).
 * - Quantity is REAL and must be positive; units are free text (`g`, `kg`,
 *   `pcs`, …) so Bangla and English units both work.
 * - The purchased invariant lives in the database itself, mirroring tasks:
 *   an item is purchased exactly when it has a `purchased_at` timestamp.
 * - Items may be assigned to a family member (migration 006 runs first, so
 *   the table exists). ON DELETE SET NULL keeps the item when a member is
 *   removed.
 */
export const migration007: Migration = {
  version: 7,
  name: 'grocery',
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE grocery_lists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        notes TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_grocery_lists_archived_updated
        ON grocery_lists (is_archived, updated_at DESC);

      CREATE TABLE grocery_items (
        id TEXT PRIMARY KEY,
        list_id TEXT NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        quantity REAL NOT NULL DEFAULT 1 CHECK (quantity > 0),
        unit TEXT CHECK (unit IS NULL OR length(trim(unit)) > 0),
        estimated_price_minor INTEGER CHECK (
          estimated_price_minor IS NULL OR estimated_price_minor >= 0
        ),
        actual_price_minor INTEGER CHECK (
          actual_price_minor IS NULL OR actual_price_minor >= 0
        ),
        is_purchased INTEGER NOT NULL DEFAULT 0 CHECK (is_purchased IN (0, 1)),
        purchased_at TEXT,
        assigned_member_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (is_purchased = 1 AND purchased_at IS NOT NULL) OR
          (is_purchased = 0 AND purchased_at IS NULL)
        )
      );

      CREATE INDEX idx_grocery_items_list
        ON grocery_items (list_id, is_purchased, created_at);
      CREATE INDEX idx_grocery_items_member
        ON grocery_items (assigned_member_id);
    `);
  },
};
