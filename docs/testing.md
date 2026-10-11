# Jibon — Testing

## Commands

```bash
npm test          # jest — all suites
npm run typecheck # tsc --noEmit (strict)
npm run lint      # eslint (expo lint; includes react-hooks + React Compiler rules)
```

Run all three before considering any change done.

## Database tests run real SQLite

Repositories and migrations are typed against a minimal `SqlDatabase` interface
(`src/db/sql.ts`). In tests, `tests/helpers/node-sqlite-database.ts` adapts Node's built-in
`node:sqlite` (synchronous `DatabaseSync`) to that interface, so Jest executes the **same SQL,
schema, and constraints** as the device — no database mocks. The device path uses
`src/db/sqlite-adapter.ts` over expo-sqlite.

`tests/helpers/node-sqlite-database.ts` provides:

- `createNodeSqliteDatabase(path)` — in-memory by default, or a temp file for restart tests.
- `createMigratedDatabase()` — applies pragmas + all migrations.

## Suite map

| Suite | Covers |
| --- | --- |
| `tests/db/migrations.test.ts` | Fresh apply + version record; idempotent re-run; failing migration rolls back (version unchanged, table absent); duplicate/incorrect version lists rejected |
| `tests/db/task-repository.test.ts` | CRUD roundtrip; ordering rules for pending/completed/all views; filters; case-insensitive LIKE search incl. `%`/`_` escaping; limit/offset; every CHECK constraint and FK behavior (`ON DELETE SET NULL`) via raw SQL |
| `tests/db/persistence.test.ts` | Temp-file DB: insert → close → reopen → migrations re-run (no-op) → data intact ("app restart") |
| `tests/services/task-service.test.ts` | Validation (no write on invalid input), trimming/defaults, clock + ID injection, idempotent complete/reopen (keeps original `completed_at`), delete, error mapping (storage failure → `database` code) |
| `tests/features/grouping.test.ts` | Section splitting/order/omission, completed section |
| `tests/utils/dates.test.ts` | Date string validation (impossible dates, leap years), arithmetic, display + relative labels |
| `tests/ui/components.test.tsx` | TaskItem (render, toggle, press, a11y label), TextField (label, change, error, Optional) |
| `tests/ui/tasks-screen.test.tsx` | Tasks screen: empty state + CTA navigation, rows, overdue subtitle, checkbox toggle, row open with params, FAB, error retry, notice banner, no-matches + clear filters |

## UI test notes (RNTL v14)

- `render()` and `fireEvent.*` are **async** in RNTL v14 — every call must be awaited, and test
  callbacks are `async`.
- `expo-router` and the feature hooks (`useTasks`, `useTaskForm`) are mocked via `jest.mock`
  automock; retrieve typed handles with `jest.Mocked`/casts from the imported module.
- Safe-area context is mocked manually in tests.

## Conventions

- Deterministic time and IDs: services take `now` and `generateId` dependencies; tests never depend
  on wall-clock time or random UUIDs.
- Tests assert user-visible behavior (labels, testIDs, states), not implementation details.
- New schema → extend `tests/db/migrations.test.ts` expectations; new SQL → repository tests; new
  business rule → service tests.

## Manual live run (web target)

There is no emulator on the dev machine, so end-to-end behavior is also exercised by running the
exported web build in a browser (same app code; expo-sqlite compiles to WASM, persisting to OPFS):

```bash
npx expo export --platform web --output-dir dist/web
# serve dist/web with COEP: require-corp + COOP: same-origin headers (see docs/implementation-status.md)
```

The 2026-10-11 run script covered: add → list refresh → complete → reopen → delete (confirm and
decline) → empty-title rejection → search/filters → completed tab → multiple full reloads for
persistence. Results and found bugs are recorded in `docs/implementation-status.md`. Any UI change
should be re-checked this way until a device is available.

## Environment limitation

No Android emulator/device is available on the current development machine (no `adb`/Java). Device
verification steps and their status are tracked in `docs/implementation-status.md`; until those run,
UI correctness rests on RNTL tests, the browser live run, and a successful Android bundle export.
