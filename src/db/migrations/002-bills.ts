import type { Migration } from './types';

/**
 * 002 — Bills and installment schedules.
 *
 * Numbering note: the product plan lists this schema as migration "005" in a
 * suggested sequence that assumes notes/finance/transfers land first. The
 * migration runner requires versions to be contiguous from 1, and bills are
 * the first module built after tasks, so this is 002. Successor modules take
 * 003+ in the order they are implemented (see `docs/database-schema.md`).
 *
 * Model decision (per master prompt "bills, bill_occurrences, bill_payments,
 * if required by the chosen model"): there is no separate `bill_payments`
 * table. An occurrence is payable at most once, so the payment record lives
 * on the occurrence itself (`paid_amount_minor`, `paid_on`) behind a CHECK
 * invariant. Duplicate payments are therefore structurally impossible — the
 * single UPDATE that marks an occurrence paid is guarded by
 * `status = 'pending'` — which is exactly the "bill payment recorded exactly
 * once" requirement.
 *
 * Money: `expected_amount_minor` / `paid_amount_minor` are integer minor
 * units (poisha). 1 BDT = 100 minor units. Floats are never stored.
 *
 * Dates: `due_on` / `paid_on` / `first_due_on` are calendar dates
 * (`YYYY-MM-DD`), not instants, so a due date never shifts across time
 * zones. `created_at` / `updated_at` are ISO-8601 UTC instants.
 */
export const migration002: Migration = {
  version: 2,
  name: 'bills',
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE bills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        category TEXT NOT NULL CHECK (category IN (
          'electricity', 'internet', 'water', 'gas', 'rent', 'phone',
          'credit_card', 'subscription', 'education', 'other'
        )),
        expected_amount_minor INTEGER NOT NULL CHECK (expected_amount_minor > 0),
        recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK (recurrence IN (
          'none', 'weekly', 'monthly', 'quarterly', 'yearly'
        )),
        first_due_on TEXT NOT NULL CHECK (
          first_due_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        installment_count INTEGER CHECK (
          installment_count IS NULL OR
          (installment_count >= 2 AND installment_count <= 240)
        ),
        reminder_days_before INTEGER CHECK (
          reminder_days_before IS NULL OR
          (reminder_days_before >= 0 AND reminder_days_before <= 30)
        ),
        notes TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE bill_occurrences (
        id TEXT PRIMARY KEY,
        bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
        due_on TEXT NOT NULL CHECK (
          due_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        expected_amount_minor INTEGER NOT NULL CHECK (expected_amount_minor > 0),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
        paid_amount_minor INTEGER CHECK (
          paid_amount_minor IS NULL OR paid_amount_minor > 0
        ),
        paid_on TEXT CHECK (
          paid_on IS NULL OR
          paid_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (bill_id, due_on),
        CHECK (
          (status = 'paid' AND paid_amount_minor IS NOT NULL AND paid_on IS NOT NULL) OR
          (status = 'pending' AND paid_amount_minor IS NULL AND paid_on IS NULL)
        )
      );

      CREATE INDEX idx_bill_occurrences_status_due
        ON bill_occurrences (status, due_on);
      CREATE INDEX idx_bill_occurrences_bill_due
        ON bill_occurrences (bill_id, due_on);
      CREATE INDEX idx_bills_archived ON bills (is_archived);
    `);
  },
};
