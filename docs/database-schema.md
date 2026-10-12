# Gochao — Database Schema

Status: migrations **001–005** are implemented and tested (`src/db/migrations/`).
Successor migrations are planned for their respective phases and are **not** created yet. Nothing
in this document claims otherwise.

## Conventions

| Concern | Convention | Why |
| --- | --- | --- |
| IDs | `TEXT PRIMARY KEY` holding UUID v4 from `Crypto.randomUUID()` (expo-crypto) | Stable, offline-generatable, merge-safe for future backup/restore |
| Instants | ISO-8601 UTC strings (`2026-10-11T09:30:00.000Z`) via `nowIso()` | Lexicographically sortable, unambiguous |
| Calendar dates | `YYYY-MM-DD` strings (no time, no zone) in `due_at` style columns | "Due Friday" must stay Friday regardless of time zone; compared as strings |
| Money | INTEGER minor units (poisha) for all monetary columns (bills use this today). **Never floats.** | Exact arithmetic; see master prompt §17.7 |
| Column names | `snake_case` in SQL, mapped to `camelCase` domain objects in repositories | Clear boundary between storage and domain |
| Enums | `TEXT` + `CHECK (col IN (...))` | Readable, constrainable, migration-friendly |
| Deletion | Explicit per relationship (`SET NULL`, `RESTRICT`, or deliberate cascade). Financial/health history must not be cascade-deleted | master prompt §6 |

Runtime pragmas (set in `src/db/database.ts` on every open):

- `PRAGMA journal_mode = WAL` — better crash resilience, lower writer contention.
- `PRAGMA foreign_keys = ON` — SQLite requires this per-connection; without it FKs are inert.

## Migration system

`src/db/migrate.ts`:

- Each `Migration` is `{ version, name, up(db) }` (`src/db/migrations/types.ts`).
- The runner asserts the list is contiguous from 1 with no duplicate versions.
- Each pending migration runs inside `withExclusiveTransactionAsync`; on any error the transaction
  rolls back and the previous `user_version` remains — a failed migration leaves the database
  exactly at the last successful version.
- After success: `PRAGMA user_version = <n>` (interpolated only because the value is a validated
  integer constant; PRAGMA cannot take bound parameters).
- Applying on an up-to-date database is a no-op (verified by test).

## Migration 001 — `initial-schema` (implemented)

Source of truth: `src/db/migrations/001-initial-schema.ts`.

```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  due_at TEXT CHECK (
    due_at IS NULL OR
    due_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed')),
  parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status = 'pending' AND completed_at IS NULL)
  )
);

CREATE INDEX idx_tasks_status_due_at ON tasks (status, due_at);
CREATE INDEX idx_tasks_parent_task_id ON tasks (parent_task_id);
```

### Notes on `tasks`

- **Completion invariant in SQL**: the table-level `CHECK` means a row cannot be `completed`
  without a completion timestamp, nor `pending` with one. Tests exercise this with raw `UPDATE`s,
  so violations cannot slip in from future code paths.
- **`due_at` is date-only** and format-checked by `GLOB` (SQLite has no date type). Format
  correctness beyond the pattern (e.g. month 13) is enforced at the service layer
  (`isValidIsoDate`) before insert.
- **`parent_task_id` is the foundation for recurrence and subtasks** (Phases 4+). `ON DELETE SET
  NULL` keeps child rows when a parent is deleted rather than silently destroying them.
- **`title` is trimmed before insert/update by the service**, so `length(trim(title)) > 0`
  effectively means "not empty".
- **Indexes** follow the two hot queries: list-by-status ordered by due date, and future
  child-task lookups. The completed-view query (`status = 'completed' ORDER BY completed_at DESC`)
  uses `idx_tasks_status_due_at` for the status prefix.

### Notes on `app_settings`

Key/value store for app-level preferences (e.g. language choice in Phase 2; later non-secret
settings only). **Secrets do not belong here** — PIN verifiers and encryption key material go to
platform secure storage (`docs/security.md`).

## Migration 002 — `bills` (implemented)

Source of truth: `src/db/migrations/002-bills.ts`.

```sql
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

CREATE INDEX idx_bill_occurrences_status_due ON bill_occurrences (status, due_on);
CREATE INDEX idx_bill_occurrences_bill_due ON bill_occurrences (bill_id, due_on);
CREATE INDEX idx_bills_archived ON bills (is_archived);
```

### Notes on `bills` / `bill_occurrences`

- **Numbering**: the product plan suggests bills as migration “005” in a sequence where
  notes/finance land first. The runner requires contiguous versions and bills are the first module
  built after tasks, so this is `002`; successor modules take `003+` in implementation order.
- **No `bill_payments` table** (the master prompt allows either model). An occurrence is payable at
  most once, so the payment record lives on the occurrence (`paid_amount_minor`, `paid_on`) behind
  the table-level CHECK: `paid` requires both payment fields, `pending` forbids them. A duplicate
  payment is therefore structurally impossible — the single UPDATE that marks an occurrence paid is
  guarded by `status = 'pending'`, and re-recording is idempotent (returns the existing payment).
- **`UNIQUE (bill_id, due_on)`** makes schedule materialization idempotent: generating occurrences
  from the recurrence rule uses `INSERT … ON CONFLICT DO NOTHING`, so calling it on every screen
  load cannot create duplicates.
- **`reminder_days_before` is a stored preference only** — not yet wired to OS notifications (that
  infrastructure is a later phase; the UI states this honestly).
- **Delete semantics**: `ON DELETE CASCADE` removes a deleted bill's occurrences; the service only
  allows deleting a bill with **no recorded payments** (guarded atomically in SQL), so payment
  history can never be destroyed by a delete (master prompt rule 10). Archive is the alternative.
- **Recurrence, `first_due_on`, and `installment_count` are immutable after creation** (enforced at
  the service/UI level, not by a trigger): changing them would silently rewrite an existing
  schedule including possibly-paid occurrences.

## Migration 003 — `finance` (implemented)

Source of truth: `src/db/migrations/003-finance.ts`. Accounts, categories, and transactions
(income/expense), plus the built-in category seed.

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'mfs', 'savings', 'other')),
  currency TEXT NOT NULL DEFAULT 'BDT' CHECK (length(trim(currency)) > 0),
  opening_balance_minor INTEGER NOT NULL DEFAULT 0 CHECK (opening_balance_minor >= 0),
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
CREATE UNIQUE INDEX idx_categories_kind_name ON categories (kind, name COLLATE NOCASE);
CREATE INDEX idx_categories_kind_archived ON categories (kind, is_archived);

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
  bill_occurrence_id TEXT UNIQUE REFERENCES bill_occurrences(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_transactions_occurred_on ON transactions (occurred_on);
CREATE INDEX idx_transactions_account_occurred ON transactions (account_id, occurred_on);
CREATE INDEX idx_transactions_category_occurred ON transactions (category_id, occurred_on);
```

Plus the built-in category seed: 6 income + 13 expense rows with stable IDs (`cat_income_salary`,
`cat_expense_food`, …), `is_builtin = 1`, and a natural `sort_order`. The UI translates built-in
IDs (`categories.<id>` keys) and displays stored names for custom categories.

### Notes on the finance tables

- **Numbering**: the product plan suggested notes+categories as `002`; notes are not built yet, so
  the category table landed here with the finance schema it serves (bills took `002`). Migrations
  stay contiguous and forward-only.
- **Amounts are integer minor units (poisha)** and always positive; `kind` carries the sign —
  floats are never stored (rule 7). Balance math is `opening + income − expenses + incoming
  transfers − outgoing transfers`, all integer arithmetic. No balance is stored: it is derived.
- **`bill_occurrence_id UNIQUE`** makes “one expense per recorded bill payment” a structural
  invariant: retried or double-tapped recording cannot create a second expense. `ON DELETE SET
  NULL` (the occurrence side cascades only when a payment-free bill is deleted, so this is a
  belt-and-suspenders case) keeps the expense row if its link ever disappears.
- **`ON DELETE RESTRICT` on `account_id`/`category_id`**: an account or category with transaction
  history cannot be deleted at the SQL level; the services surface archive as the alternative —
  financial history can never be destroyed by deleting a container (rule 10). The seed guards also
  make deleting a built-in category impossible (service check), while custom categories can be
  deleted only when unused; otherwise archived.
- **`idx_accounts_name` is `COLLATE NOCASE` unique**: “Cash” and “cash” are the same account.

## Migration 004 — `transfers_budgets` (implemented)

Source of truth: `src/db/migrations/004-transfers-budgets.ts`.

```sql
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
CREATE INDEX idx_transfers_from_occurred ON transfers (from_account_id, occurred_on);
CREATE INDEX idx_transfers_to_occurred ON transfers (to_account_id, occurred_on);
CREATE INDEX idx_transfers_occurred_on ON transfers (occurred_on);

CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL UNIQUE REFERENCES categories(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Notes on `transfers` / `budgets`

- **A transfer is one row, never two transaction rows.** Money moving between the user’s own
  accounts is therefore structurally excluded from every income/expense sum and report
  (engineering rule 11 needs no filtering logic); both account balances move when the single row
  is written. `CHECK (from_account_id <> to_account_id)` rejects self-transfers at the schema
  level.
- **Budgets are monthly by definition** (Module D: “monthly budgets by category”), so there is no
  period column: one row per expense category, `UNIQUE (category_id)`. Usage (spent/remaining/
  percent/exceeded) is derived from stored transactions at read time and never persisted, so it
  cannot drift from the ledger.
- **`ON DELETE RESTRICT`** keeps history safe: a category holding a budget, or an account named in
  a transfer, cannot be deleted silently — the service offers archive instead.

## Migration 005 — `notes` (implemented)

Source of truth: `src/db/migrations/005-notes.ts`. Notes (Module C) with categories and tags.

```sql
CREATE TABLE note_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_note_categories_name ON note_categories (name COLLATE NOCASE);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  category_id TEXT REFERENCES note_categories(id) ON DELETE SET NULL,
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(trim(title)) > 0 OR length(trim(content)) > 0)
);
CREATE INDEX idx_notes_pinned_updated ON notes (is_pinned DESC, updated_at DESC);
CREATE INDEX idx_notes_category ON notes (category_id);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_tags_name ON tags (name COLLATE NOCASE);

CREATE TABLE note_tags (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);
CREATE INDEX idx_note_tags_tag ON note_tags (tag_id);
```

### Notes on the notes tables

- **A note is a title, a body, or both.** The table-level `CHECK` requires at least one non-blank
  field, so the service's `note_empty` validation is backed by the schema — a blank note cannot be
  inserted by any future code path either. Unlike `tasks.title`, `title`/`content` allow empty
  strings (individually); the service still trims before writing.
- **Plain text, extensible model.** No HTML/Markdown columns in this phase (master prompt Module C
  declares plain text for the MVP with rich formatting later); the columns are unconstrained
  `TEXT` (length limits: 120 chars title / 20,000 chars body, enforced at the service layer) so a
  later `format` column can be added additively.
- **Category deletion keeps notes.** `ON DELETE SET NULL`: removing a category must not destroy
  the user's notes (rule 9/10 spirit); the note simply becomes uncategorized. Category names are
  unique case-insensitively.
- **Tag links cascade both ways.** Deleting a note removes its tag links; deleting a tag removes
  its links. The `tags` row itself survives (an unused tag is harmless and can be reused);
  `deleteTagIfUnused` exists for housekeeping but the UI never deletes tags automatically — no
  user data is removed silently (rule 9).
- **"Pinned first, then most recently modified" is one index.** `idx_notes_pinned_updated
  (is_pinned DESC, updated_at DESC)` backs the default list ORDER BY directly. Pinning writes
  `is_pinned` only — it never bumps `updated_at`, so pinning does not masquerade as a modification
  (the list's "Updated …" date stays honest; covered by repository and service tests).
- **Search is parameterized LIKE with escaping.** `title LIKE ? OR content LIKE ?` with
  `ESCAPE '\'` and a service-side pattern that escapes `\`, `%`, `_` — a note titled `100% done`
  is found by typing `100%` and does not act as a wildcard (rule 8; tested).

## Planned migrations (not yet implemented)

Per the product plan (master prompt §6); each lands with its feature phase. Version numbers are
assigned dynamically in implementation order (bills took `002`, finance `003`–`004`), so the table
below names contents, not fixed numbers:

| Contents | Phase |
| --- | --- |
| `medicines`, `medicine_schedules`, `medicine_logs`, `appointments`, `health_records` | 8 |
| `prayer_settings`, `prayer_logs` | 8 |
| `reminder_metadata`, `attachments` | J / later phases |

Shipped from this table: `family_members`, `family_requests` (migration 006),
`grocery_lists`, `grocery_items` (migration 007), `prayer_settings`,
`prayer_day_times`, `prayer_logs` (migration 008), and `medicines`,
`medicine_schedules`, `medicine_logs`, `appointments`, `health_records`
(migration 009), `watchlist_items` (migration 010), and the prayer
`reminders_enabled` flag (migration 011). `household_purchases`
(finance-linked purchase records) is
deferred to the expense-recording follow-up.

Planned indexes from the master prompt (added with their tables): family request status+due date,
medicine schedule active status. (Transactions’ date, account+date, and category+date indexes are
already implemented by migration 003; bill due date+status by `idx_bill_occurrences_status_due`.)

Design rules that will apply to those migrations:

- Monetary columns are INTEGER minor units; transfers are a distinct table so they can never count
  as income/expense.
- Delete behavior is chosen per table (e.g. deleting an account must not destroy its transaction
  history; historical records are archived/deactivated instead).
- Every migration is additive and forward-only; destructive changes require an explicit data
  migration inside the same version.

## Data integrity tooling

- All statements are parameterized (`?` placeholders) through `SqlDatabase`; the only interpolation
  is the validated `PRAGMA user_version` integer.
- LIKE search patterns are escaped for `\`, `%`, `_` and used with `ESCAPE '\'`, so a task titled
  `50%` (or a note titled `100% done`) is searchable literally (`src/db/sql.ts:escapeLikePattern`
  and the note repository's `likePattern`).
- Multi-step operations use exclusive transactions. Currently: migrations, bill payment recording
  (payment + linked expense, or undo + reversal), and note create/update with tag links (note write
  + link replacement in one transaction). Bill schedule materialization and transfers are
  deliberately single guarded/idempotent statements instead (a transfer is one row, so the write is
  atomic by nature — see Migration 004 notes).
- Persistence across restarts is covered by `tests/db/persistence.test.ts`: it writes to a temp
  file database, closes it, reopens it, re-runs migrations (no-op), and verifies the data.

## Backup implications (Phase 9, not implemented)

A backup must contain a format version independent of `user_version` (the spec's
`"format": "jibon-backup", "version": 1` envelope), export all tables with IDs and timestamps
preserved, and be encrypted with authenticated encryption. Restore will be **replace-all with a
pre-restore safety backup** (master prompt §11). Details and crypto plan: `docs/security.md`.
