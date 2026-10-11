# Jibon — Implementation Status

Snapshot: **2026-10-11**. Scope of current work per the master prompt: **Phase 0, Phase 1, and
Phase 2** (plus a UI design-language pass — see below), the **Bills & Installments module
(master prompt Module E / roadmap “Phase 6”)**, and the **Personal Finance module (master prompt
Module D — আয়-ব্যয় / roadmap “Phase 5”)**, each built next at the user’s request.

## Phase checklist

| Phase | Status | Notes |
| --- | --- | --- |
| 0 — Repository inspection and planning | ✅ Done | Project scaffolded under `D:\Personal\Product\jibon`; docs created (this set + `docs/master-prompt.md`) |
| 1 — Project foundation | ✅ Done (code) / ✅ live-run verified on web / ⚠️ Android device launch not verified here | Tasks vertical slice end-to-end; full add → complete → reopen → delete flow exercised in a running browser build on 2026-10-11 |
| 2 — Localization and application shell | ✅ Done (code) / ✅ live-run verified on web | i18n (en/bn) with persisted language preference, bottom tabs, Home dashboard from real DB data, More screen; acceptance criterion “all implemented UI is localizable and navigable” checked below |
| Module E — Bills & Installments (roadmap Phase 6) | ✅ Done (code) / ✅ live-run verified on web | Built out of roadmap order at the user’s request. Migration 002, services, UI (tab + 4 screens), dashboard preview; full flow live-verified 2026-10-11 — see the live-run account |
| **Module D — Personal Finance (আয়-ব্যয়, roadmap Phase 5)** | ✅ Done (code) / ✅ live-run verified on web | Built out of roadmap order at the user’s request. Migrations 003–004, five repositories + five services, UI (tab + 9 screens), bill-payment → expense integration, dashboard money card + quick actions. All ten §14 financial-correctness tests pass — mapping below; flow live-verified 2026-10-11 |
| 3 — App lock and security foundation | ⬜ Not started | Plan and verified constraints are documented in `docs/security.md` (incl. SQLCipher findings) |
| 4, 7–10 | ⬜ Not started | Bills (Phase 6) and finance (Phase 5) are the exceptions and are complete |

## UI design language (adopted 2026-10-11)

The user supplied reference screenshots of a polished Bangla-first family-finance app and asked for
that visual language. What was adopted and what was consciously **not**:

- **Adopted**: cream background, teal primary, navy hero summary card with progress bar and
  overdue/due-today columns, gold/purple accents, round quick actions, two-line kicker+title screen
  headers, bottom tab bar with an active pill, generous radii.
- **Only real modules get UI.** The reference has five tabs (হোম/আয়-ব্যয়/বাজার/ভাড়াটিয়া/আরও);
  **আয়-ব্যয় (finance) and বিল (bills) are now real**; grocery/tenants arrive with Phases 6–7.
  Shipping them now would mean dead tabs and fake data, which the master prompt forbids.
  Shipped tabs: **হোম (Home) / কাজ (Tasks) / বিল (Bills) / আয়-ব্যয় (Finance) / আরও (More)**.
  The More screen lists the remaining upcoming modules with their phases, clearly labeled as not
  yet built.
- **No fake statistics.** The hero card and the “Money this month” card show only real,
  database-derived figures (task counts and financial totals respectively). No numbers are mocked
  anywhere.
- **English remains the default language** (master prompt §9). Bangla is one tap away and persists.

## What is implemented

### Database & data layer

- SQLite initialization with WAL + foreign keys (`src/db/database.ts`).
- Versioned migration runner (`src/db/migrate.ts`): ordered, transactional per migration, rollback
  on failure, version list validation, idempotent re-run.
- Migration 001: `app_settings`, `tasks` (with completion invariant CHECK, priority/status CHECKs,
  `due_at` format CHECK, self-FK `parent_task_id ON DELETE SET NULL`), two indexes.
- Driver-agnostic `SqlDatabase` interface + expo-sqlite adapter.
- `SqliteTaskRepository`: parameterized SQL only, LIKE-search with wildcard escaping, ordering
  rules per view, limit/offset pagination, `count()` and `countCompletedBetween()` (dashboard).
- `SqliteSettingsRepository`: `app_settings` get/set (upsert) — stores the language preference.

### Business layer

- `createTaskService` with injected clock and ID generator: validation (title ≤ 140, description ≤
  2000, valid calendar dates, priority enum), trimming/defaulting, idempotent complete/reopen
  (preserves original `completed_at`), delete, list and count with filters.
- `AppError` model with codes; storage errors never leak SQL. Validation failures carry stable
  codes that the UI translates (`src/i18n/errors.ts`) — no user-facing English in the service.

### Bills & installments (Module E — built 2026-10-11)

- **Types & pure utils**: `src/types/bill.ts` (categories, recurrences, occurrence statuses, input
  types), `src/utils/money.ts` (integer-minor-unit parsing/formatting, Bangla digit input),
  `src/utils/recurrence.ts` (schedule stepping with day-of-month clamping + Bangla-calendar-safe
  date math). All unit-tested.
- **Migration 002** (see `docs/database-schema.md`): `bills` + `bill_occurrences`, 3 indexes,
  completion/payment CHECK invariants, `UNIQUE (bill_id, due_on)`.
- **`SqliteBillRepository`**: parameterized SQL only; due/history joins carry bill name + category;
  summary query derives `nextDueOn` and paid counts; occurrence materialization uses
  `ON CONFLICT DO NOTHING`; delete evaluates its “no recorded payments” guard atomically inside the
  DELETE. Real-SQLite tests cover ordering, filters, idempotent materialization, and every CHECK.
- **`createBillService`**: create/update/archive/delete (immutable schedule fields after create),
  `ensureOccurrencesAhead()` (idempotent, 60-day horizon, anchor always materialized, bounded by
  `installmentCount`), due/history lists, summaries, `monthDueTotal`.
- **`createBillPaymentService`**: `recordPayment` is idempotent — an occurrence holds at most one
  payment behind a `status = 'pending'`-guarded UPDATE, so double taps / retries / races cannot
  create a second payment (the “recorded exactly once” requirement); `undoPayment` reverses it
  (no-op when pending). Both are covered by race-style tests.
- **Honesty rules implemented, not just documented**: the pay modal, the bill detail, and the
  service source all state that Jibon records payments locally and never pays the biller or
  contacts a bank (master prompt severity rule 13); the reminder field is labeled as a stored
  preference until OS notifications exist; deleting a bill with payments is blocked in SQL with the
  UI explaining that archiving is the alternative (rule 10).

### Personal finance (Module D — আয়-ব্যয়, built 2026-10-11)

- **Types & pure utils**: `src/types/finance.ts` (accounts, categories, transactions, transfers,
  budgets, activity rows); month helpers in `src/utils/dates.ts` (`monthKeyOf`,
  `monthBoundsForKey`, `addMonthsToKey`, `yearBoundsOf`); integer-minor-unit money helpers in
  `src/utils/money.ts` (`parseAmountToMinor`, `minorToInputText`, `normalizeDigitInput`,
  `MAX_AMOUNT_MINOR`). All unit-tested.
- **Migrations 003–004** (see `docs/database-schema.md`): `accounts`, `categories` (+ the 19
  built-in income/expense seed rows with stable IDs), `transactions` (with the
  `bill_occurrence_id UNIQUE` link), `transfers` (own table, `CHECK (from <> to)`), `budgets`
  (one monthly limit per expense category). History-protecting FKs (`ON DELETE RESTRICT`).
- **Repositories** (`SqliteAccountRepository`, `SqliteCategoryRepository`,
  `SqliteTransactionRepository`, `SqliteTransferRepository`, `SqliteBudgetRepository`):
  parameterized SQL only. Highlights: derived balances in SQL (`opening + income − expense +
  in − out transfers`), the unified activity feed as a UNION over transactions/transfers with
  kind/account/category/date/search filters and pagination, `sumActivity`/`sumByCategory`/
  `monthTotals` aggregates that read **only** the transactions table (rule 11 holds by
  construction), `deleteIfUnused` guards evaluated atomically inside the DELETE.
- **Services** (`account`, `category`, `transaction`, `transfer`, `budget`): validation with
  stable codes (`finance-validation.ts`), trimming/normalization, archive semantics, protections —
  built-in categories cannot be renamed/deleted (archive instead), accounts/categories with
  history cannot be deleted (archive instead), transfers must be between two distinct active
  accounts, one budget per expense category.
- **Bill payment → expense integration (done)**: recording a bill payment against an account
  creates exactly one linked expense **inside the same exclusive transaction** — amount and date
  come from the actual payment, the category is mapped from the bill category, and
  `UNIQUE (bill_occurrence_id)` makes a duplicate expense structurally impossible even under
  retries or concurrent callers. `undoPayment` reverses payment and expense in one transaction;
  “record without account” records the payment only. Covered by race-style service tests.
- **Bill-linked expenses are locked**: the transaction form shows an info banner and disables
  save/delete for expenses that carry a `bill_occurrence_id` (server-side, the service rejects
  them) — you undo the payment on the bill instead, so the pair can never diverge.
- **UI (tab + 9 screens)**: Finance overview (`/finance`: balance card, quick actions, accounts
  preview, recent activity, links), accounts management (`/finance-accounts`, `/account-form`),
  month-grouped activity with search + kind filters (`/finance-transactions`), income/expense
  form (`/transaction-form`), transfer form (`/finance-transfer`, states “never counted as income
  or expenses”), budgets (`/finance-budgets`, `/budget-form`), reports (`/finance-reports`),
  categories (`/finance-categories`, `/category-form`). Distinct empty/error/loading states,
  destructive-action confirmations, pull-to-refresh.
- **Reports** (`use-finance-reports`, no report tables): daily/weekly/monthly/yearly ranges,
  income vs expense + net, largest categories, full category breakdown with shares, a zero-filled
  six-month net-savings series (`savings-chart`), budget usage rows, and account balances — all
  aggregated from read-only repository queries at read time.
- **Dashboard integration**: a “Money this month” card (income / expenses / net savings / spent
  today / total balance — all DB-derived, rule 6) plus **Add income** and **Add expense** quick
  actions that deep-link into the transaction form.
- **Not counted anywhere by construction**: transfers are a separate table, so no report, sum, or
  balance can treat them as income/expense (rule 11); money is integer minor units end-to-end
  (rule 7); balances are always derived, never stored (rule 6).

### Internationalization (`src/i18n/`)

- Lightweight homegrown i18n (a “compatible alternative” to i18next, which §9 allows): pure
  `createTranslator` + nested JSON dictionaries (`en.json`, `bn.json`) + React provider.
- Plural keys (`key_one` / `key_other`), `{{param}}` interpolation, missing-key fallback to
  English and finally to the key itself (visible, never a crash).
- Bangla numerals by digit mapping (no Intl dependency — Hermes-safe); `formatNumber` groups
  thousands only where wanted. A dictionary-parity test guarantees bn/en have identical keys.
- Language preference persisted in `app_settings`; startup overlay waits for the preference read so
  a saved Bangla preference never flashes English.

### App shell & screens

- Bottom tabs (expo-router `Tabs`): **Home** (dashboard), **Tasks**, **More** — active-state pill,
  localized labels, icons.
- **Home dashboard** (real DB data only): navy hero card (pending due today + overdue, progress bar,
  overdue / due-today columns, percent badge), quick actions (New task, All tasks — both real),
  today's task sections with complete/reopen, empty state with a real CTA, FAB, pull-to-refresh.
- **Tasks screen**: search (debounced 250 ms), status/priority filters, sections (Overdue / Due
  today / Upcoming / No due date / Recently completed), overdue count, pagination for completed,
  distinct empty states, error state with retry, action-error banner.
- **More screen**: language switch (English / বাংলা), about card (version, privacy statement, and an
  honest note that PIN lock and database encryption are not enabled yet), upcoming-modules list with
  phase badges.
- **Add/edit modal**: fully localized; title, description, priority chips, due quick picks + native
  date picker, validation messages, delete with destructive confirmation.
- **Bills tab** (`/bills`): three segments — **বাকি/Due** (grouped Overdue / Today / Next 7 days /
  Later with counts, record-payment action per card), **বিলসমূহ/Bills** (every bill with category ·
  recurrence · installment progress and next-due line; archived ones badged), **পরিশোধ/History**
  (recorded payments, paginated). Distinct empty states, error state with retry, action banner,
  FAB with a11y label, pull-to-refresh.
- **Bill form** (`/bill-form`, modal): name, amount (decimal-pad), 10 category chips, 5 recurrence
  chips, first-due entry (ISO text field + preview + quick chips + native picker), optional
  installments (shown for repeating schedules) and reminder days with an honest “stored now,
  notifications later” note, notes. Edit mode shows the schedule read-only with an explanation;
  delete asks for destructive confirmation. All validation errors are translated codes.
- **Bill detail** (`/bill-detail`): offline-record note (rule 13), identity card (icon, name,
  category · recurrence, expected amount), facts (first due, installment progress, reminder,
  created date), Edit / Archive|Restore / Delete (disabled with a reason while payments exist),
  and the full occurrence timeline with per-status actions (record payment / undo payment with
  confirmation).
- **Record payment** (`/bill-pay`, modal): disclaimer banner, occurrence context, prefilled
  expected amount and today’s date, quick date chips, validation, idempotent submit.
- **Home dashboard**: quick actions gained **Bills**; an **Upcoming bills** section shows the
  nearest pending occurrences (real data, hidden when none) with a See-all link.
- All new strings ship in both dictionaries (parity-test enforced), including money formatting in
  Bangla numerals (৳১,২৫০).
- All pre-Phase-2 strings were extracted (search, filters, empty/error states, banners, a11y
  labels, delete confirmations). Intentional English-only surfaces: the boot-error screen (renders
  before i18n is up) and platform-native UI (browser/Alert confirm buttons, the Android date
  picker dialog).

## Verification evidence (commands run on this machine, 2026-10-11)

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | ✅ Exit 0, no errors (typed routes regenerated via `expo start` for all new routes) |
| Lint | `npx eslint .` | ✅ 0 errors; remaining warnings are the pre-existing test-file `import/first` pattern after `jest.mock` (unavoidable and expected) — `src/` is warning-free |
| Tests | `npx jest` | ✅ 32 suites, **329/329 tests pass** |
| Web bundle | `npx expo export` (web) | ✅ 19 static routes incl. all finance screens (`/finance`, `/finance-accounts`, `/account-form`, `/finance-transactions`, `/transaction-form`, `/finance-transfer`, `/finance-budgets`, `/budget-form`, `/finance-reports`, `/finance-categories`, `/category-form`) + WASM SQLite worker chunk |
| Android bundle | `npx expo export --platform android` | ✅ Hermes bytecode bundle (`entry-*.hbc`, 3.7 MB) |
| Live run (web) | static serve of `dist/` + browser automation | ✅ Phase 2, bills, **and finance** flows exercised against a real persisted database — account below |

Test suites: migrations (fresh/idempotent/rollback/validation, incl. the bills and finance
tables/indexes/seed), task repository (roundtrip, ordering, filters, search escaping, pagination,
counts, all CHECK/FK constraints, ON DELETE SET NULL), bill repository (due/history ordering +
filters, summaries, idempotent materialization, payment-guard constraints, delete guard),
**finance repositories** (account balance derivation + case-insensitive names + delete guards,
category seed/order/usage, transaction round-trips + date CHECK + activity feed (filters, search,
pagination) + `sumActivity`/`sumByCategory`/`monthTotals` excluding transfers, transfer round-trip
+ self-transfer rejection, one-budget-per-category + spend derived from stored rows only, and a
numbered financial-correctness block mirroring §14), persistence (restart), task
service (validation, clock/ID injection, idempotency, counts, error mapping), bill service
(creation validation, immutable schedule, recurrence materialization incl. installment bounds and
clamping, archive behavior), bill payment service (exactly-once recording incl. concurrent-caller
simulation, idempotent re-record and undo, validation, and the **linked-expense integration**:
exactly one expense per payment incl. concurrency, actual amount/date, category mapping, no
expense without an account, archived-account rejection), **finance services** (account/category/
transaction/transfer/budget validation + archive/delete semantics + locked bill-linked expenses),
recurrence utils (stepping, clamping, horizon), money utils (parsing/formatting incl. Bangla
digits), grouping (pure, tasks + bill due sections), dashboard summary + finance summary (pure),
dates utils (incl. local-day UTC bounds and month/year key helpers), i18n (dictionary
parity, plural/interpolation/digits, fallback, format helpers incl. `formatMoney`, validation-code
translation incl. bill **and finance** codes, locale parsing), settings repository (real SQLite),
UI components (TaskItem, TextField), and the screens: Tasks, Dashboard (incl. bills preview and
the money card), More, Bills (segments/sections/navigation/empty/error), the bill form
(create/edit/delete-confirm), the bill pay screen (disclaimer, prefill, submit, validation),
**Finance** (overview figures/nav/empty states, accounts management, transactions list with month
totals, reports incl. derived shares + budget/account summaries + range switching, budgets list +
form incl. all-budgeted guard, transaction form incl. the bill-locked banner, transfer form incl.
the same-account guard), and the language-switch flow (provider + real SQLite: switch, persist,
reload, failure-tolerant ready).

**These tests run against real SQLite** (Node's built-in `node:sqlite`) executing the same SQL and
migrations as the device — the database tests are not mocked.

### Master prompt §14 financial-correctness tests — mapping

“Do not consider the finance module complete until these tests pass.” All ten pass:

| # | Requirement | Where |
| --- | --- | --- |
| 1 | Opening balance plus income | `tests/db/finance-repository.test.ts` — “1. opening balance plus income” |
| 2 | Expense reducing the correct account | same file — “2. expense reduces the correct account only” |
| 3 | Transfer reducing one account and increasing another | same file — “3. transfer reduces one account and increases the other” |
| 4 | Transfer excluded from income/expense reports | same file — “4. transfers are excluded from income and expense reports” (+ `sumActivity` suite) |
| 5 | Monthly date boundaries | same file — “5. monthly date boundaries include first/last day and exclude neighbours” |
| 6 | Editing and deleting a transaction | same file — “6. editing and deleting a transaction updates balances” |
| 7 | Bill payment recorded exactly once | `tests/services/bill-payment-service.test.ts` — exactly-once/concurrent recording + one linked expense (`UNIQUE (bill_occurrence_id)`) |
| 8 | Refund handling | `tests/db/finance-repository.test.ts` — “8. refunds are income transactions that offset expenses (documented refund model)” |
| 9 | Budget calculation | same file — “9. budget calculation: spent, remaining, and exceeded status from stored rows” |
| 10 | Currency formatting | `tests/utils/money.test.ts` + i18n format tests (`formatMoney`: `৳1,250`, Bangla digits, poisha only when non-zero) |

## Live run account (web target, 2026-10-11)

The app was run for real in a browser against the exported web build, using the same application
code and the same SQL migrations (expo-sqlite compiles to wa-sqlite/WASM on web, persisting to
OPFS). Verified in the running app in this pass:

1. Home dashboard opens with the real date line (“Sunday, 11 October”), time-of-day greeting, and
   hero card showing DB-derived zeros; quick actions and empty state render; a leftover task from
   the earlier run still lived in OPFS (proof of data continuity across builds).
2. Added “Review the new dashboard” with due date = Today via the FAB → hero immediately shows
   1 still-to-do, 0% done, due-today 1; the task appears in the Today section.
3. Toggling the checkbox → hero switches to **100% done**, pending 0, empty pending list (the
   completed-today count is real data, not decoration).
4. More screen: full content verified (version, privacy statement, honest security note, roadmap
   with phase badges in Bangla digits).
5. Switched to বাংলা → the whole app re-renders in Bangla instantly (labels, tabs হোম/কাজ/আরও,
   Bangla numerals ০/১০০, phase badges পর্যায় ৪…৯).
6. Full page reload → app boots directly in Bangla (no English flash; preference read from
   `app_settings` before the shell shows) and the completed task still shows 100% done.
7. Tasks tab in Bangla: subtitle “১ টি কাজ চলমান”, search placeholder, filter chips, sections
   সামনের কাজ / সম্প্রতি সম্পন্ন, and Bangla a11y labels on checkboxes (“শেষ করুন: …”).

Phase 1 flows (add/complete/reopen/delete, error states, OPFS persistence across reloads) were
verified in the earlier run on 2026-10-11 and remain covered by tests; see the git-less change log
in this doc’s history for that account’s bug list (focus-refresh, web transaction fallback,
deferred `onError`, `canGoBack` fallback, web confirm, aria aliases, web picker).

### Bills module live run (same day, same build pipeline)

Executed against the exported web build served with the isolation headers, in the persisted Bangla
profile, using the browser automation tool:

1. **Home** shows three quick actions including **বিল/Bills**, and four tabs (হোম / কাজ / বিল /
   আরও). The Bills tab opened on the empty state (“কোনো বিল বাকি নেই”, ০ টি বিল বাকি).
2. **Created a bill** (“ইন্টারনেট বিল”, ৳1,250, category ইন্টারনেট, monthly, first due today,
   12 installments) through the form — date entry on web uses the ISO text field + quick chips
   (the native picker button is correctly absent on web).
3. **Occurrence materialization verified**: the due list immediately showed **Today** (1) and
   **Later** (1) — the next monthly occurrence (১১ নভেম্বর ২০২৬) was generated within the horizon;
   the header kicker switched to “২ টি বিল বাকি”.
4. **Recorded a payment**: the pay modal showed the disclaimer (“জীবন শুধু এই ডিভাইসে পরিশোধটি লিখে
   রাখে — বিলটি পরিশোধ করে না।”), the occurrence context, prefilled amount (1250) and date; after
   submitting, the due list dropped to just the November occurrence (১ টি বিল বাকি) — exactly-once
   recording, no duplicate.
5. **History** segment listed the payment (“পরিশোধ আজ”, Paid ৳…) and **Bills** segment showed the
   bill with “পরের বিল ১১ নভেম্বর ২০২৬”.
6. **Detail screen**: offline note banner, identity + facts cards, installment progress
   **১/১২ পরিশোধ** (Bangla digits), and the paid/pending timeline with per-status actions. Delete
   was **disabled** with the visible reason “পরিশোধ লেখা থাকলে বিল মোছা যায় না। বদলে আর্কাইভ করুন।”
   — the rule-10 guard working in the live UI.
7. **Full page reload**: the bill, its paid occurrence, and the November schedule all survived
   (OPFS persistence), the dashboard now rendered the **আসন্ন বিল / Upcoming bills** preview
   (১, “ইন্টারনেট বিল, ১১ নভেম্বর ২০২৬”, See-all → `/bills`), and the browser console logged **no
   errors** during the whole session.

### Finance module live run (same day, same build pipeline)

Executed against the exported web build (English locale) with browser automation, on the same
persisted database:

1. **Finance tab** opened on the real empty state (৳0 balances, “No accounts yet”, “No activity
   yet”). Created **Cash in hand** (type cash, opening balance ৳5,000) → the overview immediately
   showed **Total balance ৳5,000** and Accounts 1.
2. **Added an expense** (৳1,250, Groceries, “Weekly groceries”, today) → balance ৳3,750, expenses
   this month ৳1,250, net **-৳1,250**, and the row appeared in Recent activity.
3. **Added income** (৳5,000, Salary, “October salary”). This surfaced a real bug: new transactions
   did not preselect a category, so saving failed with a misleading “category is not available”
   error. Fixed (first category is now preselected, mirroring the account default), re-exported,
   and re-verified — the income saved; month totals became ৳5,000 in / ৳1,250 out / ৳3,750 net.
4. **Created a second account** (bKash, mobile banking, opening ৳1,000) and **transferred ৳500**
   from Cash in hand → bKash. The transactions list showed the transfer row (“Cash in hand →
   bKash”) while the month header stayed **৳5,000 in / ৳1,250 out** — rule 11 verified in the live
   UI. Balances moved exactly: ৳8,250 / ৳1,500, total **৳9,750**.
5. **Reports** rendered from stored data: ৳5,000 / ৳1,250 / ৳3,750 summary, largest categories
   (Groceries ৳1,250, 100% share), the six-month net-savings series (zero-filled May–Sep, Oct
   ৳3,750), budget-usage and account-balance sections; switching **Daily ↔ Weekly ↔ Monthly ↔
   Yearly** recomputed the period figures.
6. **Created a monthly Groceries budget** (৳2,000) → the budgets screen listed “October 2026” with
   derived usage, and the reports budget-usage section picked it up as a row.
7. **Dashboard** showed the **“Money this month”** card with the same DB-derived figures (income
   ৳5,000, expenses ৳1,250, net ৳3,750, “Spent today ৳1,250”, “Total balance ৳9,750”) plus the new
   **Add income / Add expense** quick actions; no console errors during the session.

## Phase 2 acceptance (master prompt §16) — honest status

Criterion: “all implemented UI is localizable and navigable.”

| Check | Status |
| --- | --- |
| English + Bangla dictionaries for every user-facing string that ships | ✅ `tests/i18n/translate.test.ts` enforces exact key parity between locales |
| Language selection persisted and applied on restart | ✅ Live-verified (reload boots in Bangla); tested against real SQLite (`tests/ui/language-switch.test.tsx`, `tests/db/settings-repository.test.ts`) |
| Bottom navigation reaches every implemented screen | ✅ Live-verified (Home/Tasks/More tabs); only real modules have tabs |
| Empty, loading, and error states on implemented screens | ✅ Dashboard/Tasks/More tests + live run; error retry verified |
| No hardcoded dashboard statistics | ✅ Dashboard figures come from `count()`/`countCompletedBetween()`; live-verified updating after create/complete |
| Stable codes separated from translated labels | ✅ Validation returns codes; UI maps through `translateValidationCode`/`translateError`; enum storage values never translated |
| Bangla numeral rendering | ✅ Digit mapping (grouping only in `formatNumber`); verified live (১০০%) and in tests |

## Known limitations and follow-ups

- **Android device verification still pending on this machine** (no adb/Java). All Phase 1/2,
  bills, and finance acceptance items marked “web-verified” should be confirmed on-device before
  device acceptance.
- **Bills: payment → expense integration is done** (recording against an account files exactly one
  linked expense in the same transaction; undo reverses both). A payment deliberately recorded
  with “no account” keeps its older shape — payment only, no expense — and the pay screen states
  this.
- **Bills: no default account on the bill itself** — the account is chosen at payment time on the
  pay screen (per payment, with a “record without account” option), instead of a per-bill field.
  Revisit only if the master prompt's “optional account link” is interpreted as bill-level.
- **Bills: reminders are a stored preference only** — `reminderDaysBefore` is saved and shown, but
  OS notification scheduling is a later phase; the form and detail screen say so explicitly.
- **Bills: web date entry is text-based** (ISO field + quick chips); the native picker button is
  hidden on web (no web implementation in `@react-native-community/datetimepicker`).
- **Finance: single currency by display.** Accounts carry a `currency` column (default `BDT`) but
  no conversion, rates, or multi-currency roll-up exist; totals assume one currency.
- **Finance: transfers appear in the activity feed and account record counts** by design
  (they happened), but are excluded from every income/expense sum, report, and dashboard figure —
  the exclusion is structural (separate table), not a filter.
- **Finance: reports use fixed range presets** (daily/weekly/monthly/yearly); no custom
  date-range picker yet.
- **Finance: budgets are monthly and per-category only** — no overall/total budget and no
  rollover between months.
- **Finance: no export** (CSV/PDF) yet; backup arrives in Phase 9 with authenticated encryption.
- **Bangla renders with system fonts.** No custom Bangla typeface is bundled yet; dedicated fonts
  are a deliberate later polish step (size/weight currently rely on platform defaults).
- **No custom date-picker localization** — the native picker dialog uses the platform language;
  quick-pick chips are localized.
- **No UI test for the task-form modal** (add/edit/delete screens) — still a recommended
  follow-up. (The bill, finance, and dashboard screens do have UI tests.)
- **UI tests mock feature hooks**, so hook-level orchestration (e.g. `useBills` pagination,
  `useTransactions` search debounce) is covered indirectly through service/repository tests rather
  than in-component.
- **Unused template dependencies** (e.g. `@expo/ui`, `expo-glass-effect`, `expo-symbols`,
  `expo-image`, `expo-web-browser`, reanimated/worklets, gesture-handler) remain installed from the
  template; app code does not import them. Pruning is a deliberate change awaiting review.
- **Light theme only** (`userInterfaceStyle: "light"`); dark-mode tokens deferred.
- **No PIN, no DB encryption yet** — plaintext SQLite in the app sandbox. See `docs/security.md`;
  do not describe the app as encrypted or locked until Phase 3 lands and is verified on-device.
  (The More screen itself states this to the user.)
- **Web target is a development/verification environment, not a product platform.** The date
  picker dialog is unavailable there (quick-date chips work); browser OPFS eviction applies.
- **`dist/` is per-export**: a single-platform export replaces the others in `dist/`. Run
  `npx expo export` (all platforms) before browser verification.
- **App icon/splash are template placeholders** (colors adapted); real branding deferred.

## How to run the web target (used for live verification)

Requirements live in `metro.config.js` (both needed for expo-sqlite’s WASM worker):

- `config.resolver.assetExts.push('wasm')` — without it, bundling fails on
  `./wa-sqlite/wa-sqlite.wasm`.
- `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin` headers —
  required for `SharedArrayBuffer`/OPFS persistence.

Supported path (used here): `npx expo export --platform web`, then serve the `dist/` folder
statically **with the two isolation headers** (a tiny Node server was used; plain file-servers that
do not send the headers will load a memory-only database).

Known issue with the *dev server* on Windows (`npx expo start --web`): the Metro dev server with
lazy bundling cannot both seal the SQLite worker chunk and emit the runtime worker paths (upstream
Expo/Metro issue on Windows). The static export path avoids it entirely. Note: `expo start` is
still useful (and was used) to regenerate typed routes after adding routes.

## How to launch on Android (for a machine/device that has the toolchain)

1. Fastest (no native build): `npm install` → `npx expo start` → scan QR with Expo Go on Android.
   Works because Phases 1–2 use only Expo Go-compatible modules. **When SQLCipher is enabled in
   Phase 3, Expo Go will no longer work.**
2. Development build (required from Phase 3): `npx expo run:android` (needs Android SDK + JDK), or
   an EAS cloud dev build (`npx eas build --profile development --platform android`).
3. Production bundle sanity check (no device needed): `npx expo export --platform android` (was
   run; succeeds).

## Phase 1 acceptance tests (master prompt §16) — status carried forward

| # | Criterion | Status |
| --- | --- | --- |
| 1 | The app opens | ✅ Live-verified (web). ⚠️ Android device launch unverified here; Android bundle compiles |
| 2 | User can add a task | ✅ Live-verified (row confirmed in DB file bytes); UI + unit tested |
| 3 | Task appears in the list | ✅ Live-verified; UI tests cover rows rendering from hook data |
| 4 | Mark complete | ✅ Live-verified (incl. dashboard progress change); service + UI tests |
| 5 | Reopen | ✅ Live-verified; service + UI tests |
| 6 | Delete after confirmation | ✅ Live-verified (confirm and decline paths); service/repository tested |
| 7 | Empty titles rejected | ✅ Live-verified; service rejects with no write; TextField shows error |
| 8 | Data remains after restart | ✅ Live-verified (multiple full reloads restore from OPFS) + DB-level reopen test. Device restart not executed here |
| 9 | Core operations work offline | ✅ By construction: zero network code. Device airplane-mode run pending |
| 10 | Database failures produce an error message | ✅ Observed live (real failure rendered the error screen with retry); UI-tested |
| 11 | TypeScript reports no new errors | ✅ `tsc --noEmit` exit 0 |
| 12 | App can be launched on the target Android environment | ❌ **Not verified here** — no Android SDK/adb/Java. See launch path above |
| 13 | Lint and tests green | ✅ `eslint` exit 0 (src warning-free); latest full run: 329/329 jest tests pass |

## Next step (per master prompt §20)

Phases 1–2, the **Bills & Installments module**, and the **Personal Finance module (আয়-ব্যয়)**
are code-complete and green (tsc/lint/329 tests/bundles) and live-verified on the web build.
Two parallel next actions:

1. **On-device acceptance** for Phases 1–2, bills, and finance when an Android device/emulator is
   available (run the acceptance tables above, incl. app-restart persistence and airplane mode).
2. **The next build phase**: either **Phase 3 (app lock and security foundation)** — constraints
   already documented in `docs/security.md`; a development build becomes mandatory there — or the
   next requested module (e.g. Phase 4 notes, the last unbuilt step of the original sequence).
