# Jibon

A privacy-focused, offline-first personal life management app for Android. Bilingual
(English/Bangla), BDT-oriented, no backend: everything lives in a local SQLite database on the
device.

Built with Expo SDK 57, React Native 0.86, TypeScript (strict), Expo Router, and expo-sqlite.

[![Download Android APK](https://img.shields.io/badge/Download%20APK-Android-2ea44f?style=for-the-badge&logo=android)](https://github.com/arafatmollah/Gochao/releases)
[![Build APK Workflow](https://github.com/arafatmollah/Gochao/actions/workflows/build-apk.yml/badge.svg)](https://github.com/arafatmollah/Gochao/actions/workflows/build-apk.yml)

---

## 📲 Download for Mobile (Android)

You can download and install the standalone Jibon app directly onto any Android device without Google Play Store:

- **[⬇️ Download Latest Android APK](https://github.com/arafatmollah/Gochao/releases)** *(Direct download from GitHub Releases)*
- **[📦 Download from CI Artifacts](https://github.com/arafatmollah/Gochao/actions/workflows/build-apk.yml)** *(Select the latest run and download the `Jibon-Android-APK` artifact)*

### How to Install on Your Android Phone:
1. Tap the download link above on your Android device to download `Jibon.apk`.
2. Open your device's **Downloads** folder or tap the download completed notification.
3. If prompted with *"For your security, your phone is not allowed to install unknown apps from this source"*, tap **Settings** and toggle **Allow from this source**.
4. Tap **Install** to finish setup and launch Jibon.

---

## Current status

Phases 0–2 are implemented: database initialization + versioned migrations, the task
repository/service, a bottom-tab shell (**Home / Tasks / Bills / Finance / More**), the Home
dashboard (hero card, quick actions, a real “Money this month” card, today's tasks and an
upcoming-bills preview — all real database data), full localization (English/Bangla with a
persisted language preference in `app_settings`), and the working Tasks screen (add, edit,
complete/reopen, delete with confirmation, search, filters, sections, due dates).

The **Bills & Installments module** (built on request ahead of its roadmap phase) is also
implemented: recurring bills (migration 002 — `bills` + `bill_occurrences`), schedules with
installment counts, occurrence generation, record/undo payment (exactly-once by construction),
due and history views, bill detail with offline-payment disclaimer, archive/delete rules, and a
dashboard preview. Money is stored as integer minor units (poisha), never floats, and a local
payment record is never treated as proof of external payment.

The **Personal Finance module (আয়-ব্যয়)** is implemented (migrations 003–004): accounts
(cash/bank/mobile banking/savings/other) with opening balances and archive-not-delete semantics,
income/expense transactions with built-in + custom categories, transfers as their own table
(**never counted as income or expenses** — by construction, not by filtering), monthly
per-category budgets with derived usage, reports (daily/weekly/monthly/yearly: income vs
expenses, category breakdowns, six-month savings, budget usage, account balances), category
management, and the bill-payment → expense integration (recording a payment against an account
files exactly one linked expense inside the same database transaction; undo reverses both).
All ten financial-correctness tests required by the master prompt §14 pass against real SQLite;
on-device acceptance is still pending.

The **Notes module (নোট)** is implemented (migration 005): plain-text notes with create/edit/
delete, pin-to-top (pinned first, then most recently modified — pinning never rewrites the
"Updated" date), search across titles and bodies, categories (deleting one keeps its notes) and
tags (created on first use, linked in the same transaction as the note), a Notes screen with
category filters and empty/no-match states, a More entry card, and a dashboard preview of the
three most recently modified notes. Notes stay persistent and searchable offline — verified live.

329 tests passed at the finance milestone; the suite now stands at **363 tests across 36 suites**
(incl. 31 notes tests). TypeScript and lint are clean; web and Android bundles export; and the
Phase 1 + Phase 2 + bills + finance flows were exercised in live browser runs on 2026-10-11,
followed by the notes flow on 2026-10-12 (create, content search, pin, edit, delete-with-confirm,
and persistence across a full reload — including the Bangla switch surviving a full reload, a
transfer leaving income/expense totals untouched, and the dashboard money card matching the
database). Device launch has not been verified on this machine (no Android toolchain here) —
details and the launch path are in
[docs/implementation-status.md](docs/implementation-status.md).

Not implemented yet, and not to be claimed as working: app-lock/PIN, database encryption,
family/groceries/prayer/health modules, OS notifications for bill reminders, backups. The More
screen lists these modules with phase badges and states plainly that PIN lock and encryption are
not enabled yet.

## Requirements

- Node.js 20+ (developed on v26)
- npm
- For device launch: the Expo Go app on Android, or an Android SDK + JDK for a development build

## Setup and commands

```bash
npm install          # install dependencies

npm start            # start the dev server (Expo Go / dev build)
npm run android      # start and open on Android
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # eslint via expo lint
npm run test             # jest (unit, database, service, i18n, UI)
npm run build:apk        # build standalone installable Android APK with EAS Build
```

Launch options:

1. **Downloadable standalone APK (Recommended for users)**:
   - Download the prebuilt APK from the [Releases](https://github.com/arafatmollah/Gochao/releases) or GitHub Actions.
   - Or generate a fresh cloud APK with `npm run build:apk` (runs `npx eas-cli@latest build -p android --profile preview`).
2. **Expo Go** (fastest, current feature set): `npm start`, then scan the QR code on Android.
3. **Development build** (required once database encryption/SQLCipher lands in Phase 3):
   `npx expo run:android` with Android SDK/JDK installed, or `npx eas build --profile
   development --platform android`.
4. **Bundle sanity check** (no device): `npx expo export --platform android`.
5. **Web (development/verification target)**: `npx expo export --platform web`, then serve `dist/`
   with `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin`
   headers (needed by the SQLite WASM worker for persistent storage). `metro.config.js` adds the
   `.wasm` asset support and dev-server headers. The Metro *dev server* web path has an upstream
   Windows/worker-chunk bug; use the static export (details in
   [docs/implementation-status.md](docs/implementation-status.md)). Note: each `expo export`
   replaces `dist/`, so export web last when preparing the browser target.

## Project structure

```
src/
├── app/          Expo Router routes — (tabs) shell: Home, Tasks, Bills, Finance, More;
│                 task/bill/account/transaction/transfer/budget/category/note forms,
│                 bill detail, bill payment, accounts, transactions, budgets, reports, notes
├── components/   Shared UI primitives (Button, TextField, Card, Chip, Fab, ScreenHeader, …)
├── db/           SqlDatabase interface + adapter, migrations 001–005,
│                 repositories (tasks, bills, settings, notes, accounts, categories,
│                 transactions, transfers, budgets)
├── features/     Feature modules (tasks, dashboard, bills, finance, notes: hooks, components,
│                 pure helpers)
├── i18n/         Translator engine + provider, en/bn dictionaries, formatting, error mapping
├── services/     Business rules (task, bill/payment, note, account, category, transaction,
│                 transfer, budget services + validation)
├── theme/        Design tokens
├── types/        Domain types
└── utils/        Dates, IDs, errors, money (minor units), recurrence
tests/            Jest suites (database tests run real SQLite via node:sqlite)
docs/             Architecture, schema, security, status
```

## Documentation

- [docs/architecture.md](docs/architecture.md) — layers, decisions, data flow
- [docs/database-schema.md](docs/database-schema.md) — conventions, migrations 001–005, planned migrations
- [docs/security.md](docs/security.md) — current security state, PIN/encryption plan, threat model
- [docs/implementation-status.md](docs/implementation-status.md) — what's done, verified, pending
- [docs/master-prompt.md](docs/master-prompt.md) — the full product/build specification

## Principles

- Offline-first: all core operations work without network; SQLite is the source of truth.
- No accounts, no telemetry, no data leaving the device.
- Parameterized SQL only; migrations for every schema change; transactions for multi-step writes.
- Money is integer minor units (poisha), never floats — bills, transactions, transfers, and
  budgets all follow this; balances and reports are always derived, never stored or hardcoded.
- Transfers between own accounts are never counted as income or expenses (a separate table makes
  it structural).
- Deleting an account/bill/category can never destroy financial history — archive is the
  alternative, enforced in SQL.
- English is the default language; Bangla is one tap away and persists. Stored values are never
  translated — only their presentation.
- Security claims only after verification. See `docs/security.md`.
