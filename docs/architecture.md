# Jibon — Architecture

Status: reflects Phase 0/1, the Phase 2 shell and localization, the Bills & Installments and
Personal Finance modules, and the Notes module (2026-10-12). Updated as the app evolves.

Jibon is a privacy-focused, offline-first personal life management app for Android. It has no
backend, no account system, and no network dependency: all data lives in a local SQLite database
inside the app sandbox.

## Tech stack (installed versions)

| Layer | Choice | Version |
| --- | --- | --- |
| Runtime | Expo SDK | ~57.0.27 |
| UI | React Native / React | 0.86.3 / 19.2.3 |
| Language | TypeScript (strict) | ~6.0.3 |
| Routing | Expo Router (file-based, typed routes, Tabs) | ~57.0.25 |
| Database | expo-sqlite | ~57.0.4 |
| i18n | homegrown pure translator + JSON dictionaries (en/bn) | — |
| IDs / randomness | expo-crypto | ~57.0.3 |
| Date input | @react-native-community/datetimepicker | 9.1.0 |
| Tests | Jest + jest-expo + @testing-library/react-native | 29.7 / ~57.0.5 / ^14.1.0 |
| Lint | eslint-config-expo (includes react-hooks + React Compiler rules) | ~57.0.2 |

React Compiler and typed routes are enabled (`experiments` in `app.json`).

## Layering

```
Screens (src/app/**)                   — routes, presentation, loading/empty/error states
  └── Feature hooks (src/features/*)   — screen state, orchestration, grouping/formatting
        └── Services (src/services/*)  — business rules, validation codes, error mapping
              └── Repositories (src/db/repositories/*) — SQL, row mapping
                    └── SqlDatabase (src/db/sql.ts)    — minimal driver-agnostic interface
                          ├── expo-sqlite adapter (device)
                          └── node:sqlite adapter (Jest, real SQLite)

Cross-cutting: src/i18n/ — translation engine, dictionaries, React provider,
locale-aware formatting, error-code → message mapping (consumed by screens/components)
```

Rules enforced by convention (see `docs/master-prompt.md` §17):

- Screens never contain SQL. All persistence goes through services → repositories.
- SQL is always parameterized. The only interpolated value is `PRAGMA user_version = N`, where `N`
  is a validated integer migration constant (PRAGMA statements cannot take bound parameters).
- Multi-step writes run inside transactions (`withExclusiveTransactionAsync`).
- The database is the source of truth; UI state is never optimistically reported as saved.
- Services emit stable validation/error **codes**, never user-facing English; screens translate via
  `src/i18n/errors.ts`. Stored values (e.g. `high`, `pending`) are never translated in the data
  layer — only their presentation is.
- Dashboard statistics are always derived from stored records; nothing is hardcoded (rule 6).

## Directory layout (current)

```
jibon/
├── src/
│   ├── app/                     # Expo Router routes
│   │   ├── _layout.tsx          # theme + SQLiteProvider + I18nProvider + stack; boot gates
│   │   ├── (tabs)/              # bottom tab shell
│   │   │   ├── _layout.tsx      # Tabs: Home / Tasks / Bills / Finance / More (active pill)
│   │   │   ├── index.tsx        # Home dashboard (hero, quick actions, money card, notes preview)
│   │   │   ├── tasks.tsx        # Tasks screen (list, search, filters, sections, FAB)
│   │   │   ├── bills.tsx        # Bills screen (Due / Bills / History segments, FAB)
│   │   │   ├── finance.tsx      # Finance overview (balance, quick actions, accounts, recent)
│   │   │   └── more.tsx         # More: notes entry card, language switch, about, upcoming modules
│   │   ├── task-form.tsx        # add/edit modal, priority, due date, delete
│   │   ├── notes.tsx            # Notes screen (search, category chips, pinned-first list, FAB)
│   │   ├── note-form.tsx        # add/edit note modal (category, tags, pin, delete)
│   │   ├── bill-form.tsx        # add/edit bill modal (schedule immutable in edit mode)
│   │   ├── bill-detail.tsx      # bill identity, facts, schedule timeline, archive/delete
│   │   ├── bill-pay.tsx         # record a payment (local record only; disclaimer banner)
│   │   ├── finance-accounts.tsx # account list/archive (no silent delete)
│   │   ├── account-form.tsx     # add/edit account modal
│   │   ├── finance-transactions.tsx # month-grouped activity list (search + kind filters)
│   │   ├── transaction-form.tsx # add/edit income/expense modal
│   │   ├── finance-transfer.tsx # transfer between own accounts (never income/expense)
│   │   ├── finance-budgets.tsx  # monthly budgets with derived usage
│   │   ├── budget-form.tsx      # add/edit budget modal
│   │   ├── finance-reports.tsx  # ranges, breakdowns, savings series, budget/account summaries
│   │   └── finance-categories.tsx + category-form.tsx # category management
│   ├── components/              # shared UI: app-text, screen, screen-header, fab, button,
│   │                            # text-field, card, chip, badge, empty-state, error-state,
│   │                            # loading-state, section-header, search-field, banner, confirm
│   ├── db/
│   │   ├── sql.ts               # SqlDatabase interface + LIKE-pattern escaping
│   │   ├── sqlite-adapter.ts    # expo-sqlite → SqlDatabase adapter
│   │   ├── database.ts          # open config: WAL, foreign_keys, migrations
│   │   ├── migrate.ts           # versioned migration runner
│   │   ├── migrations/          # 001-initial-schema.ts … 005-notes.ts (+ types, index)
│   │   └── repositories/        # task, settings, note, account, category, transaction,
│   │                            # transfer, budget
│   ├── features/
│   │   ├── tasks/               # grouping.ts, components/task-item.tsx, hooks/
│   │   ├── notes/               # components/note-card.tsx, hooks/use-notes.ts,
│   │   │                        # hooks/use-note-form.ts
│   │   ├── bills/               # grouping.ts (due sections), meta.ts (category icons),
│   │   │                        # components/occurrence-card.tsx, components/bill-row.tsx,
│   │   │                        # hooks/use-bills.ts, use-bill-form.ts, use-bill-detail.ts,
│   │   │                        # use-bill-pay.ts
│   │   ├── finance/             # meta.ts (category icons/names), components/ (account-row,
│   │   │                        # activity-row, balance-card, quick-actions, budget-row,
│   │   │                        # category-row, savings-chart), hooks/ (overview, accounts,
│   │   │                        # account-form, transactions, transaction-form, transfer-form,
│   │   │                        # budgets, budget-form, reports, categories, category-form)
│   │   └── dashboard/           # summary.ts + finance-summary.ts (pure), components/hero-card,
│   │                            # components/quick-actions, components/finance-summary-card,
│   │                            # hooks/use-dashboard.ts
│   ├── hooks/use-debounced-value.ts
│   ├── i18n/                    # translate.ts (pure engine), index.tsx (provider),
│   │                            # format.ts (dates/greeting/money), errors.ts (code mapping),
│   │                            # locales/en.json, locales/bn.json
│   ├── services/                # task-service.ts, task-validation.ts, note-service.ts,
│   │                            # note-validation.ts, bill-service.ts,
│   │                            # bill-payment-service.ts, bill-validation.ts, account-service,
│   │                            # category-service, transaction-service, transfer-service,
│   │                            # budget-service, finance-validation.ts
│   ├── theme/tokens.ts          # colors, spacing, radius, typography, sizes
│   ├── types/                   # task.ts, bill.ts, finance.ts, note.ts
│   └── utils/                   # id.ts, time.ts, dates.ts, errors.ts, money.ts, recurrence.ts
├── tests/                       # Jest: db, services, features, i18n, ui, utils (+ helpers)
├── docs/                        # this documentation set
└── app.json, package.json, tsconfig.json
```

Future feature modules (family, groceries, prayer, health, settings) will each get
a `src/features/<module>/` directory, their own migration (see `docs/database-schema.md`), and —
only when functional — a tab or entry point. Modules are not added as dead UI.

## Key design decisions

### 1. Driver-agnostic `SqlDatabase` interface

Repositories and the migration runner are typed against a ~5-method interface
(`execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`, `withExclusiveTransactionAsync`) instead
of expo-sqlite's `SQLiteDatabase` directly (`src/db/sql.ts`). Two adapters exist:

- `src/db/sqlite-adapter.ts` — wraps expo-sqlite on device. On web (where expo-sqlite's WASM
  build has no exclusive transactions) `withExclusiveTransactionAsync` falls back to a plain
  `withTransactionAsync`; safe because only the migration runner uses it and it runs before other
  queries are issued.
- `tests/helpers/node-sqlite-database.ts` — wraps Node's built-in `node:sqlite` (synchronous
  `DatabaseSync`), presenting the same async interface.

Why: Jest runs the **same SQL, same schema, same constraints** against real SQLite as the device.
This is not a mocked database. It also keeps the door open for SQLCipher without touching the data
layer (see `docs/security.md`).

Trade-off: one extra indirection and an adapter that must stay in sync with the used subset of the
expo-sqlite API. The adapter is small and covered indirectly by every repository test.

### 2. Versioned migrations with `PRAGMA user_version`

`src/db/migrate.ts` applies migrations in order, each inside an exclusive transaction, then records
`PRAGMA user_version = <n>`. On failure the transaction rolls back and the version stays at the last
successful one. The migration list is validated at startup (`assertMigrationListIsValid`): versions
must be contiguous from 1 with no duplicates, so a mistake fails fast in development.

`initializeDatabase()` (`src/db/database.ts`) runs `PRAGMA journal_mode = WAL` and
`PRAGMA foreign_keys = ON` before migrating. WAL survives app kills better than the default journal
and reduces writer/reader contention; foreign keys are off by default in SQLite and are required
for the `tasks.parent_task_id … ON DELETE SET NULL` behavior to hold.

### 3. Repository pattern with explicit row mapping

`SqliteTaskRepository` owns all task SQL, ORDER BY rules for each list mode, LIKE-search escaping
(`\`, `%`, `_` via `ESCAPE '\'`), and mapping snake_case rows to camelCase domain objects. Callers
see only `Task` objects. `SqliteBillRepository` follows the same discipline: due/history list
joins carry the bill’s display name + category, summary queries derive `nextDueOn`/paid counts in
SQL, and the delete guard (`NOT EXISTS paid occurrence`) is evaluated atomically inside the DELETE
statement.

### 4. Services contain business rules; DI for determinism

`createTaskService(repository, { now?, generateId? })` (`src/services/task-service.ts`) owns
validation, trimming, defaulting, and error mapping. The clock and ID generator are injected so
tests can use a fixed clock and deterministic IDs. The default ID source is
`Crypto.randomUUID()` (expo-crypto), which works offline without collisions.
`createBillService` / `createBillPaymentService` follow the same pattern (injected `now`,
`nowDate`, and `generateId`), which is what makes recurrence and payment tests deterministic.

### 5. Error model

All service failures surface as `AppError` with a code
(`validation` | `not_found` | `database` | `conflict` | `unknown`) plus a developer-facing message
(`src/utils/errors.ts`). Storage failures are wrapped without leaking SQL text. User-facing text is
produced by the i18n layer: `translateError()` maps codes (and validation sub-codes) to localized
messages — the old English `toUserMessage()` was removed so no user-facing English lives outside
the dictionaries. `translateError` logs the raw error only in `__DEV__` and never logs record
contents (see `docs/security.md`).

### 6. UI state: hooks + pure helpers, no global state library

- `use-tasks.ts` owns list state: status/priority/search filters (debounced 250 ms), pagination for
  the completed view, refresh, and request-ordering guard (`requestIdRef`) so stale async responses
  cannot overwrite newer ones.
- `use-dashboard.ts` loads the Home figures with a parallel `Promise.all` (today's pending list,
  pending-due count, overdue count, completed-today count, and the nearest upcoming bill
  occurrences) on every screen focus, re-derives them after every complete/reopen, and exposes the
  same request-id guard. It first calls `ensureOccurrencesAhead()` so the bills preview is accurate
  on a fresh install.
- `grouping.ts` is a pure function module (unit-tested without React): it splits pending tasks into
  Overdue / Due today / Upcoming / No due date and appends Recently completed. Section headers
  translate `tasks.sections.<key>` — the section objects carry stable keys, not display titles.
- `summary.ts` is a pure function module deriving `todayTotal` and `progress` from the stored
  counts (0 when nothing is tracked — never a division by zero, never a fake baseline).
- Due dates are stored date-only (`YYYY-MM-DD`) and compared as strings; "today" comes from
  `todayIsoDate()` at render time. This avoids time-zone drift for calendar-date semantics.
  "Completed today" is the opposite case — a UTC instant column bounded by `localDayBoundsIso()`
  (the device-local day converted to an exclusive-end UTC range).

No Redux or similar: the app's state is per-screen and derived from SQLite on demand
(`docs/master-prompt.md` §5 explicitly discourages heavy state infrastructure unless a concrete
need appears).

### 7. Design tokens as the single styling source

`src/theme/tokens.ts` defines the palette (cream background `#F6F4EF`, teal primary `#0E7565`,
navy hero `#211D3E` with hero-specific text/track/positive/negative tones, gold/purple accents),
spacing, radii (incl. `xl = 20` for the hero card), typography (incl. a display `heroValue`
variant), and a 48dp minimum touch target. Components consume tokens; no raw hex values outside the
token file (exception: `linkPrimary` in the template's themed-text, pending cleanup).

### 8. Testability architecture

| Test layer | Approach |
| --- | --- |
| Pure logic (dates, validation, grouping, dashboard summary, translator, format helpers) | Plain Jest unit tests |
| Database (migrations, repositories, persistence) | Real SQLite via `node:sqlite` adapter, including constraint and rollback tests and a file-backed restart simulation |
| Services | Real repository over in-memory SQLite + injected clock/ID |
| UI | React Native Testing Library with expo-router and feature hooks mocked; asserts user-visible behavior (labels, testIDs, error/empty states). The i18n provider test mocks only `useSQLiteContext` and runs against real SQLite |

### 9. Homegrown i18n instead of i18next

The master prompt (§9) requires English + Bangla with a persisted language choice and allows
“i18next, react-i18next, or a compatible alternative”. A ~130-line pure engine was chosen instead:

- `translate.ts` — locale validation, `lookupKey` (dot paths + array indices), `interpolate`
  (`{{param}}`; numbers are digit-mapped but **never grouped**, because interpolation injects
  values like years where separators would be wrong), plural resolution (`key_one`/`key_other`),
  and `createTranslator` with a 4-step lookup: locale plural → locale key → English fallback →
  the key itself (visible degradation, never a crash). `formatNumber` exists separately for the
  few places where grouped output is wanted.
- `index.tsx` — React provider that reads/writes the preference through `SqliteSettingsRepository`
  (`app_settings`, upsert). `setLocale` switches in memory first (instant UI) and persists
  best-effort; a failed read or write only warns in `__DEV__`. The provider exposes `onReady` so
  the root layout can hold its boot overlay until the stored preference is known — a saved Bangla
  user never sees an English flash.
- `errors.ts` — stable code → message mapping (`validation` sub-codes included).
- Bangla numerals are a pure digit mapping (`০`–`৯`); Hermes’ `Intl` support is not relied upon.
  A parity test asserts `bn.json` and `en.json` have identical key paths.

Trade-off: no ICU-level plural rules (Bengali/English both use one/other), no lazy locale loading.
If a third language with richer plural categories is added, the plural resolver is the piece to
generalize first.

### 10. App shell principles (from the reference design)

- Bottom tabs exist only for modules that work: **Home / Tasks / Bills / Finance (আয়-ব্যয়) /
  More**. The reference app’s grocery/rent-roll tabs arrive with their phases — no dead UI, no
  placeholder screens.
- The dashboard shows only real, DB-derived statistics; every quick action navigates to a working
  screen. Emerging modules are listed on More with explicit phase badges (“Phase 4”, …).
- English is the default locale (master prompt §9); Bangla is one tap away and persists.

### 11. Bills and installments model

Module E requirements (master prompt) plus the module’s own rules:

- **Definition vs occurrence.** `bills` holds the schedule (name, category, expected amount,
  recurrence, first due date, optional installment count, reminder preference, notes); each
  `bill_occurrences` row is one payable due that carries its own due date, expected amount,
  recorded payment amount/date, and status. Payment history is the set of paid occurrences.
- **Occurrence generation is idempotent.** `ensureOccurrencesAhead()` materializes scheduled dues
  up to a 60-day horizon for every active bill, called on every bills/dashboard load. Inserts use
  `INSERT … ON CONFLICT DO NOTHING` against `UNIQUE (bill_id, due_on)`, so repeated calls cannot
  duplicate dues, and the schedule anchor (first due date) is always materialized even when it is
  beyond the horizon. Recurrence walks from the anchor with day-of-month clamping (Jan 31 → Feb 28)
  so dates never drift; `installmentCount` bounds a কিস্তি plan exactly.
- **Payments are recorded exactly once — structurally.** There is no payments table: the payment
  fields live on the occurrence behind a table-level CHECK, and the marking UPDATE is guarded by
  `status = 'pending'`. Recording twice (double tap, retry, two callers racing) returns the first
  payment unchanged; undoing a pending occurrence is a no-op. The service is idempotent by
  contract, not by convention.
- **Immutable schedule.** Recurrence, first due date, and installment count cannot be edited after
  creation (the form shows them read-only with an explanation) — changing them would rewrite a
  schedule that may already contain paid dues.
- **Archive over delete.** Archiving hides a bill from due lists and stops generation. Deleting is
  allowed only while the bill has no recorded payments (checked atomically in SQL); otherwise the
  service returns a `conflict` and the UI explains that archiving is the alternative. A recorded
  payment can never be destroyed as a side effect of deleting a bill (rule 10).
- **A local record is never proof of payment.** Every pay surface carries the disclaimer (banner
  in the pay modal, note on the detail screen); the service doc-comment states it as well —
  severity rule 13.
- **Payments link to finance expenses (implemented).** When a payment is recorded against an
  account, `recordPayment` writes the payment and its linked expense (`transactions.
  bill_occurrence_id`, category mapped from the bill category) inside one exclusive transaction;
  `undoPayment` reverses both in the same way. `UNIQUE (bill_occurrence_id)` makes a second
  expense for one payment structurally impossible, and paying without an account (the “record
  without account” option) creates no expense. The reminder preference is still stored but not
  wired to OS notifications (the form states this).
- **Money stays integer minor units** everywhere (`expected_amount_minor`, `paid_amount_minor`,
  `utils/money.ts` parsing/formatting); `formatMoney` renders `৳1,250` / `৳১,২৫০.৫০` with poisha
  shown only when non-zero. No floats anywhere in the money path.

### 12. Personal finance model (Module D — আয়-ব্যয়, roadmap Phase 5)

Built out of roadmap order at the user’s request, after bills:

- **Accounts.** Opening balance + derived activity = current balance; nothing is stored as a
  running balance. An account with transaction history cannot be deleted (FK `ON DELETE RESTRICT`
  + a service check); archiving hides it from pickers but keeps every record and its history
  intact — deleting an account can never destroy financial history (rule 10). Account names are
  unique case-insensitively.
- **Transactions.** One table for income and expenses: `kind` carries the sign, `amount_minor` is
  always positive integer minor units. Balances are computed as opening + income − expenses +
  incoming transfers − outgoing transfers, all in integer arithmetic. Categories are seeded with
  stable IDs (built-ins translate via `categories.<id>`; custom rows store their own name);
  user-created categories are supported, archivable, and never cascade-deleted.
- **Transfers are a separate table.** A transfer is one row between two accounts, so “transfers
  are never income or expenses” is true by construction, not by filtering (rule 11);
  `CHECK (from <> to)` rejects self-transfers at the schema level.
- **Budgets.** One monthly limit per expense category (`UNIQUE (category_id)`); usage
  (`spent`/`remaining`/`percent`/`exceeded`) is derived from stored transactions at read time,
  never persisted, so it cannot drift from the ledger.
- **Reports.** No report tables: `use-finance-reports` aggregates read-only repository queries
  (`sumActivity`, `sumByCategory`, `listWithBalances`, `listWithUsage`, `monthTotals`) for daily/
  weekly/monthly/yearly ranges, largest categories, a zero-filled six-month savings series, budget
  usage, and account balances. Because the sums go through `sumActivity`, a transfer can never
  appear as income or expense in any report.
- **Bill integration** (see §11): recording a bill payment against an account creates exactly one
  linked expense in the same transaction; undo reverses both. Paying without an account records
  the payment only.
- **Dashboard integration.** `useDashboard` loads today’s expense, the month’s income/expense,
  and account balances from the database and renders the “Money this month” card plus Add
  income/Add expense quick actions — all real figures (rule 6).

### 13. Notes model (Module C — নোট, roadmap Phase 4)

Plain-text notes with optional categories and tags, built to the master prompt's Module C:

- **Create/edit/delete, pin, search, categorize, tag.** A note needs a non-blank title or body
  (schema CHECK backs the service validation). Editing sets `updated_at` from the injected clock
  and never touches `created_at`; the form displays both dates in edit mode.
- **List order is "pinned first, then most recently modified"**, backed by the composite index
  `(is_pinned DESC, updated_at DESC)`. Pinning writes only `is_pinned` — it never bumps
  `updated_at`, so pin/unpin is not presented as a modification.
- **Search covers titles and bodies** via parameterized LIKE with `\ % _` escaping; category
  filtering and an optional limit compose into one query. Tags are attached in a second grouped
  query (one `IN (…)` round trip, no N+1).
- **Categories and tags.** Category names are unique case-insensitive; deleting a category keeps
  its notes (`ON DELETE SET NULL`). Tags are created on first use, deduplicated case-insensitively,
  linked through `note_tags` (cascades both ways), and replaced atomically with the note write
  inside one exclusive transaction.
- **Plain text now, rich text later.** No format column or HTML in this phase, per Module C's MVP
  scope; the model is extensible additively.
- **Integration.** The More tab has a Notes entry card (the module is live, so it left the
  "coming later" roadmap), and the dashboard shows up to 3 most recently modified notes with pin
  toggles and an "All notes" link — all DB-derived (rule 6).

## Data flow example: opening the app

1. `src/app/_layout.tsx` renders `SQLiteProvider` with `onInit={initializeDatabase}`; inside it,
   `I18nProvider` reads the language preference.
2. `initializeDatabase` opens `jibon.db`, sets pragmas, runs pending migrations (currently 001–005).
3. The boot overlay (“Opening Jibon…”) stays up until **both** the database is ready and the
   language preference has been resolved; then the `(tabs)` shell mounts on the Home dashboard.
4. `useDashboard()` builds its repositories + services from `useSQLiteContext()`, materializes bill
   occurrences ahead (idempotent), and loads in parallel: today’s pending tasks (due ≤ today,
   limit 50), the pending-due count, the overdue count, the completed-today count
   (`localDayBoundsIso`), the nearest few pending bill occurrences, the finance figures
   (today’s expense, the month’s income/expense, account balances), and the 3 most recently
   modified notes.
   `buildDashboardSummary()` derives the progress; `buildDashboardFinance()` derives the money
   card (net savings, total balance, account count).
5. Toggling a checkbox calls `service.setCompleted()` (idempotent), then reloads — the hero card,
   columns, and progress bar all re-render from the fresh counts.
6. The Tasks tab mounts `useTasks()`, which queries pending tasks (limit 200) and recent completed
   tasks and groups them with `buildActiveSections()` for the `SectionList`.

## Constraints and environment notes

- **Expo Go vs development build.** The current feature set (expo-sqlite, expo-crypto, datetime
  picker) runs in Expo Go. Database encryption (SQLCipher) will require a development build — see
  `docs/security.md`.
- **This machine cannot launch an Android device/emulator** (no `adb`/Java toolchain installed).
  Verification here is limited to TypeScript, lint, Jest (real SQLite), production-style bundle
  exports, and a live browser run of the web build. On-device launch steps are documented in
  `docs/implementation-status.md`.
- **Bangla typography uses system fonts** — no Bangla typeface is bundled yet; sizes/weights rely
  on platform defaults.
- **Typed routes need regeneration after adding routes**: run `expo start` (or export) once so
  `.expo/types/router.d.ts` includes new paths, otherwise `tsc` rejects new `router.push(...)`
  targets.
- **`expo export` replaces `dist/` per platform** — run the web export last when the static server
  is the verification target.
- **Unused template dependencies** (e.g. `@expo/ui`, `expo-glass-effect`, `expo-symbols`,
  reanimated/worklets, gesture-handler) are still in `package.json` from the Expo template. They
  are not imported by app code. Pruning them is a deliberate post-review step; removing packages
  without review was avoided.
