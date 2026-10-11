# MASTER PROMPT: Build Jibon — An Offline-First Personal Life Management App with React Native

## 1. Your Role

Act as a senior React Native engineer, mobile application architect, database engineer, security engineer, and UI/UX designer.

Your task is to design and implement **Jibon**, a comprehensive, privacy-focused, offline-first personal life management application for Android.

Do not build a basic CRUD demo, a static UI prototype, or a collection of disconnected screens. Build a maintainable, production-oriented mobile application that helps one person manage their entire daily life from a single application.

The application must support personal organization, finances, family responsibilities, religious routines, health and medicine records, household management, bills, grocery shopping, notes, reminders, and personal records.

The app must work without an internet connection for its core features.

Work directly in the project repository when a coding environment is available. Inspect the existing files before modifying them, preserve useful existing code, and implement the application incrementally.

Do not merely return architecture suggestions or code snippets. Create and connect the actual files, run the available checks, fix errors, and document anything that cannot be completed.

---

# 2. Product Overview

**Application name:** Jibon

**Meaning:** Life.

**Primary platform:** Android.

**Framework:** React Native with Expo and TypeScript.

**Application category:** Personal life management, productivity, household management, and personal finance.

**Primary user:** One individual managing their own life and recording responsibilities for family members.

**Family mode:** Single-device family management. The user can maintain family members, record their requests, assign responsibilities, and track completion on their own device. Multi-device synchronization is outside the initial MVP.

**Operating model:** Offline-first.

**Supported languages:** English and Bangla (বাংলা).

**Initial currency:** Bangladeshi Taka (BDT, ৳).

**Data storage:** Local relational database.

**Authentication:** App-level PIN lock with optional biometric unlock.

**Backup:** Manual, encrypted export and import.

**Backend:** No backend required for the initial release.

**Cloud services:** No cloud dependency for normal application operation.

## Core product principle

The user's data must remain accessible offline after installation, without requiring an account, subscription, login to a remote service, or an internet connection.

The application must remain useful when the phone is in airplane mode.

Internet-dependent actions, such as actual bank payments, online bill payments, or sending data to another phone, must be clearly distinguished from local recordkeeping.

Do not pretend that recording a payment is equivalent to executing an actual financial transaction.

---

# 3. Mandatory Technology Stack

Use the following stack unless a documented technical limitation requires an alternative.

## Mobile application

- React Native
- Expo
- TypeScript with strict type checking
- Expo Router for file-based navigation
- React hooks for local component state
- Context only for genuinely shared application state

## Local persistence

- SQLite through Expo SQLite
- Parameterized SQL queries
- Explicit database initialization
- Versioned schema migrations
- Foreign key constraints
- Database transactions for multi-step operations
- Appropriate indexes for frequently queried records

Use a repository layer to isolate database access from the UI.

Do not use AsyncStorage as the primary database.

Do not keep important user records exclusively in React component state.

## Supporting libraries

Evaluate compatible Expo-supported packages for:

- expo-sqlite
- expo-secure-store
- expo-local-authentication
- expo-notifications
- expo-crypto
- expo-localization
- expo-file-system
- expo-document-picker
- expo-sharing
- i18next
- react-i18next
- A suitable lightweight date/time utility, if needed

Use compatible package versions for the installed Expo SDK. Check official documentation before using APIs that may have changed.

Do not install unnecessary dependencies.

## Database encryption

Evaluate SQLCipher support compatible with the selected Expo SDK and Android build configuration.

A PIN screen alone is not database encryption.

SecureStore protects secrets stored through SecureStore; it does not automatically encrypt SQLite tables.

If database encryption is not immediately compatible with the development environment, implement the data layer behind a clear abstraction and do not store real sensitive information until encryption is configured and tested.

Never invent a cryptographic implementation.

## Development environment

Assume development on Windows using VS Code and PowerShell.

Support testing on a physical Android device and, where available, an Android emulator.

---

# 4. Product Requirements and Feature Modules

Implement the modules below as parts of one integrated application.

## Module A: Home Dashboard

Build a dashboard that gives the user a useful overview of the current day.

Display:

- Current date
- Localized greeting
- Today's pending tasks
- Overdue tasks
- Completed tasks
- Upcoming bills
- Today's recorded expenses
- Current month's income
- Current month's expenses
- Estimated savings
- Account balances
- Outstanding family requests
- Upcoming medicine reminders
- Daily prayer schedule
- Quick-action buttons

Quick actions should include:

- Add task
- Add note
- Add expense
- Add income
- Add family request
- Add grocery item
- Record bill payment

The dashboard must use actual database records rather than hardcoded sample values.

For a new installation, display an intentional empty state with clear calls to action.

All dashboard calculations must work offline.

Do not recalculate financial balances independently in several screens. Use shared financial services and consistent calculation rules.

## Module B: Personal Tasks and To-Do Management

Allow the user to:

- Create a task
- Edit a task
- Delete a task
- Mark a task completed
- Reopen a completed task
- Set a priority
- Set a due date
- Add a description
- Categorize tasks
- Add optional notes
- Search tasks
- Filter by status
- Filter by priority
- View overdue tasks
- View tasks due today
- View upcoming tasks
- View completed tasks
- Create recurring tasks
- Configure reminders

Priorities:

- Low
- Medium
- High

Statuses:

- Pending
- Completed

Requirements:

- Validate task titles.
- Use stable identifiers.
- Record creation and modification timestamps.
- Record completion timestamps.
- Persist all changes in SQLite.
- Sort pending tasks appropriately.
- Avoid creating duplicate recurring tasks.
- Use a deterministic rule for generating recurring occurrences.
- Do not rely on the application being continuously open to trigger reminders.

## Module C: Notes and Personal Knowledge

Allow users to:

- Create notes
- Edit notes
- Delete notes
- Pin notes
- Search note titles and content
- Categorize notes
- Add tags
- Sort notes by recent modification
- View note creation and modification dates

Support plain-text notes in the MVP.

Keep the data model extensible for future attachments, images, checklists, and richer formatting.

Do not implement a complex rich-text editor unless it is necessary for the initial release.

## Module D: Personal Finance

This is one of the most important modules.

Build a consistent transaction-based financial model.

### Accounts

Allow users to create accounts such as:

- Cash
- Bank account
- Mobile financial service account
- Savings account
- Other personal account

Each account should have:

- ID
- Name
- Type
- Currency
- Opening balance
- Created timestamp
- Updated timestamp
- Active or archived status

Allow editing and archiving accounts.

Do not allow an account to be deleted silently if it has financial transactions. Provide a safe archive or explicit data-integrity procedure.

### Income

Allow users to record:

- Salary
- Freelance income
- Business income
- Gifts
- Refunds
- Other income sources

Each record should include:

- Amount
- Account
- Category
- Date
- Description
- Optional notes
- Creation timestamp

Support filtering by date, category, and account.

### Expenses

Allow users to record:

- Food
- Groceries
- Transport
- Rent
- Utilities
- Healthcare
- Medicine
- Education
- Family expenses
- Shopping
- Subscriptions
- Entertainment
- Other expenses

Users must be able to add their own categories.

Each expense should have:

- Amount
- Account
- Category
- Transaction date
- Description
- Optional recipient or merchant
- Optional notes
- Creation timestamp

Support editing, deleting with confirmation, searching, and filtering.

### Transfers

Implement transfers between accounts.

A transfer must reduce the source account balance and increase the destination account balance.

A transfer must not be counted as income or expense in the overall financial report.

Use a dedicated transfer model rather than recording a transfer as unrelated income and expense entries.

Use a database transaction to guarantee that both sides of a transfer succeed or neither side does.

### Financial calculations

Use integer minor units for monetary amounts.

For BDT, represent ৳100.50 as 10050 poisha.

Never use floating-point arithmetic as the source of truth for money.

Define and document these formulas:

Account balance:

Opening balance + income - expenses + incoming transfers - outgoing transfers.

Monthly net:

Monthly income - monthly expenses.

Estimated savings:

Total income - total expenses, within the explicitly selected date range.

Exclude internal transfers from income and expense totals.

Do not double-count refunds. Choose and document a consistent refund model.

### Reports

Provide:

- Daily expenses
- Weekly expenses
- Monthly expenses
- Yearly expenses
- Income versus expenses
- Category breakdown
- Account balances
- Monthly net savings
- Recent transactions
- Largest expense categories
- Budget usage

Charts are optional for the first release. Correct calculations and useful lists are more important than visual charts.

### Budgets

Allow users to define monthly budgets by category.

Display:

- Budget amount
- Amount spent
- Remaining amount
- Percentage consumed
- Budget exceeded status

All reports must be calculated from actual stored records.

## Module E: Bills and Recurring Payments

Allow users to manage:

- Electricity bills
- Internet bills
- Water bills
- Gas bills
- Rent
- Phone bills
- Credit card payments
- Subscriptions
- Education fees
- Other recurring obligations

Each bill should include:

- Name
- Category
- Expected amount
- Due date
- Recurrence rule
- Reminder settings
- Paid or unpaid status
- Payment history
- Optional account association
- Notes

Distinguish a bill definition from an individual bill occurrence.

Each payment occurrence must retain its own due date, expected amount, actual payment amount, payment date, and status.

Recording a payment should create a corresponding expense transaction when appropriate, within a database transaction, so the expense is not forgotten or counted twice.

Prevent duplicate expense creation when editing or retrying a payment operation.

Never claim that a bill was paid through an external provider merely because the user marked it paid in Jibon.

## Module F: Family Management

Allow the user to maintain a local list of family members.

Each member should have:

- ID
- Name
- Relationship
- Optional contact information
- Notes
- Creation timestamp
- Active or archived status

Family records are stored locally and do not automatically communicate with other people's devices.

### Family requests

A request may include:

- Request title
- Request details
- Family member
- Request category
- Priority
- Deadline
- Estimated cost
- Status
- Optional related bill or grocery item
- Creation and modification timestamps

Statuses:

- Open
- In progress
- Done
- Cancelled

Examples:

- Mother needs medicine.
- Father needs a doctor appointment.
- A family member needs groceries.
- Pay the electricity bill.
- Buy a requested household item.

Allow users to filter requests by family member and status.

Where practical, allow a request to generate a task or grocery item without duplicating the original request.

## Module G: Grocery and Household Management

Implement grocery lists with:

- List name
- Items
- Quantity
- Unit
- Estimated price
- Actual price
- Purchased status
- Optional assigned family member
- Notes
- Creation timestamp

Support:

- Adding items
- Editing items
- Checking off purchased items
- Removing items
- Viewing remaining items
- Calculating estimated total
- Recording actual shopping cost
- Keeping completed shopping history

When a grocery purchase is recorded as a financial expense, ensure the expense is recorded only once.

Do not automatically treat every estimated grocery price as an actual expense.

Allow household purchases to be linked to expense categories.

## Module H: Medicine and Health Records

This module is for personal recordkeeping, not diagnosis or treatment decisions.

Allow users to store:

- Medicine name
- Strength, as entered by the user
- Dosage instructions, as entered by the user
- Frequency
- Schedule
- Start date
- End date
- Prescriber or source of instructions
- Notes
- Refill reminders
- Active or archived status

Allow recording a dose as taken, skipped, or not recorded.

Do not automatically change medication instructions.

Do not infer a dosage from the medicine name.

Do not provide AI-generated medical diagnoses.

Clearly distinguish a reminder from confirmation that a dose was taken.

Allow optional records for appointments and personal health notes.

Treat all health records as sensitive information and protect them accordingly.

## Module I: Namaz and Religious Routine

Implement a prayer module supporting:

- Fajr
- Dhuhr
- Asr
- Maghrib
- Isha

Provide:

- Daily prayer schedule
- Prayer calculation configuration
- Calculation method
- Madhhab or Asr method where applicable
- Timezone
- Location settings
- Manual time adjustments
- Daily prayer completion tracking
- Prayer history
- Optional prayer reminders

Use a reliable prayer-time calculation library or a verified calculation implementation.

Do not hardcode daily prayer times.

Do not assume one calculation method is correct for every user.

Provide an appropriate configuration for Bangladesh and allow the user to change it.

Cache calculated prayer schedules locally so previously calculated schedules remain accessible offline.

Explain that future dates and changing location conditions may require recalculation or updated location data.

Do not make network access mandatory for the prayer module.

## Module J: Reminders and Notifications

Support local reminders for:

- Tasks
- Bills
- Medicine schedules
- Prayer times
- Appointments
- Grocery-related tasks
- Family requests

Requirements:

- Schedule reminders using platform-supported local notifications.
- Handle notification permissions.
- Allow reminders to be enabled or disabled.
- Support rescheduling and cancellation.
- Reconcile scheduled notifications when underlying records change.
- Handle Android notification and exact-alarm restrictions.
- Avoid scheduling unlimited individual notifications.
- Provide an appropriate strategy for recurring reminders.
- Clearly communicate limitations imposed by Android, battery optimization, and permission settings.

A notification must not be treated as proof that an action occurred.

---

# 5. Offline-First Requirements

Offline operation is a core requirement, not an optional enhancement.

Implement these rules:

1. All core records are stored locally in SQLite.
2. All ordinary create, read, update, and delete operations work offline.
3. The dashboard uses local database queries.
4. Search and filtering operate on local data.
5. Financial reports operate on local records.
6. Prayer settings and cached schedules are available offline.
7. Reminders use local scheduling mechanisms.
8. The app does not require an account or remote login.
9. The application must not silently discard records when connectivity changes.
10. Database failures must be handled with useful error messages.
11. Important operations must be transaction-safe.
12. Data remains persistent after app restarts.
13. No network request should be required to open a previously installed, fully provisioned app and use its local features.

Do not introduce Redux, a remote database, a backend API, or synchronization infrastructure unless the project demonstrates a concrete need.

Do not simulate offline operation by merely hiding network requests. The data layer itself must function locally.

---

# 6. Database Architecture

Use SQLite with a clear schema, migration system, and repository layer.

Enable foreign keys and choose appropriate journal settings.

Use parameterized queries.

Use stable IDs and consistent timestamp conventions.

Define database migrations in a versioned, ordered sequence.

Suggested initial migration sequence:

- 001: App settings and tasks
- 002: Notes and categories
- 003: Accounts and transactions
- 004: Transfers and budgets
- 005: Bills and payment occurrences
- 006: Family members and requests
- 007: Grocery lists and items
- 008: Medicine and health records
- 009: Prayer configuration and logs
- 010: Reminder metadata and attachments

Create indexes for common access patterns, including:

- Task status and due date
- Transaction date
- Transaction account and date
- Transaction category and date
- Bill due date and status
- Family request status and due date
- Medicine schedule and active status

Use database transactions for multi-step business operations.

Never assume that a successful UI state update means a database operation succeeded.

Use the database as the source of truth.

## Required tables

At minimum, design appropriate tables for:

- app_settings
- tasks
- notes
- categories
- accounts
- transactions
- transfers
- budgets
- bills
- bill_occurrences
- bill_payments, if required by the chosen model
- family_members
- family_requests
- grocery_lists
- grocery_items
- household_purchases
- medicines
- medicine_schedules
- medicine_logs
- appointments
- health_records
- prayer_settings
- prayer_logs
- reminder_metadata
- attachments

You may adjust this list to avoid redundant data, but document the reasons and relationships.

Use foreign keys where appropriate.

Define delete behavior deliberately. Do not cascade-delete critical financial history or health records without an explicit, safe workflow.

---

# 7. Application Architecture

Use a feature-oriented, layered architecture.

Recommended structure:

jibon/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── lock.tsx
│   ├── onboarding/
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── tasks.tsx
│       ├── notes.tsx
│       ├── finance.tsx
│       ├── family.tsx
│       ├── household.tsx
│       ├── prayer.tsx
│       ├── health.tsx
│       └── settings.tsx
├── src/
│   ├── components/
│   ├── features/
│   │   ├── dashboard/
│   │   ├── tasks/
│   │   ├── notes/
│   │   ├── finance/
│   │   ├── bills/
│   │   ├── family/
│   │   ├── groceries/
│   │   ├── health/
│   │   ├── prayer/
│   │   └── settings/
│   ├── db/
│   │   ├── database.ts
│   │   ├── migrations/
│   │   ├── schema/
│   │   └── repositories/
│   ├── services/
│   ├── security/
│   ├── backup/
│   ├── notifications/
│   ├── i18n/
│   │   ├── index.ts
│   │   └── locales/
│   │       ├── en.json
│   │       └── bn.json
│   ├── hooks/
│   ├── constants/
│   ├── types/
│   └── utils/
├── assets/
├── docs/
├── tests/
├── app.json
├── package.json
└── tsconfig.json

Adapt this structure to the actual Expo Router template.

Do not move every file unnecessarily. Keep route names and import paths consistent.

## Architectural responsibilities

### Screens

Responsible for presenting data, handling user input, and showing loading, empty, and error states.

Screens must not contain large blocks of raw SQL.

### Components

Reusable controls and UI elements, such as:

- Buttons
- Text fields
- Cards
- Lists
- Empty states
- Loading indicators
- Confirmation dialogs
- Amount input
- Date picker
- Search field
- Priority indicator

### Services

Contain business rules.

Examples:

- TaskService
- FinanceService
- TransferService
- BillPaymentService
- FamilyRequestService
- BackupService
- PrayerService

### Repositories

Encapsulate SQLite operations.

Examples:

- TaskRepository
- NoteRepository
- AccountRepository
- TransactionRepository
- BillRepository

### Database

Owns initialization, migrations, transactions, and connection management.

### Security

Owns app-lock behavior, secret handling, database encryption integration, and security-related configuration.

---

# 8. UI/UX Design System

Create a polished, calm, premium, minimalist mobile interface.

The interface should feel like a personal life workspace rather than an enterprise administration panel.

## Visual direction

Use:

- Warm off-white backgrounds
- Dark, readable text
- Muted sage-green or forest-green primary accent
- Rounded cards
- Subtle borders
- Consistent spacing
- Clear visual hierarchy
- Readable typography
- Minimal decorative graphics
- Simple, consistent icons
- Small, meaningful animations where appropriate

Avoid:

- Excessive gradients
- Excessive shadows
- Crowded dashboards
- Too many colors
- Tiny text
- Excessive nested cards
- Inconsistent spacing
- Unnecessary charts
- Web-style tables on mobile
- Fake metrics
- Decorative elements that reduce usability

Define reusable design tokens for:

- Colors
- Typography
- Spacing
- Radius
- Borders
- Elevation
- Icon sizes
- Button sizes

## Navigation

Use a simple bottom navigation structure, with no more than five primary destinations.

Suggested tabs:

1. Home
2. Tasks
3. Finance
4. Family
5. More

The More destination may contain Notes, Prayer, Health, Household, Bills, Reports, and Settings.

Important features must remain easy to discover.

## Forms

All forms must have:

- Clear labels
- Required-field validation
- Appropriate keyboard types
- Helpful error messages
- Save and cancel actions
- Loading states when appropriate
- Protection against duplicate submissions
- Confirmation for destructive actions

Do not rely exclusively on placeholder text as a field label.

Use keyboard-aware layouts and scrollable forms.

## Accessibility

Support:

- Screen-reader labels
- Sufficient contrast
- Large text where practical
- Reasonable touch targets
- Accessible task completion controls
- Localization without clipped labels

## Responsive behavior

Test common Android phone sizes.

Handle system font scaling, navigation insets, keyboard appearance, and Android back-button behavior.

---

# 9. English and Bangla Localization

The application must support both English and Bangla throughout the UI.

Use i18next and react-i18next, or a compatible alternative.

Create separate translation files:

src/i18n/locales/en.json

src/i18n/locales/bn.json

Do not hardcode user-facing strings throughout screens.

Translate:

- Navigation labels
- Dashboard headings
- Buttons
- Form labels
- Validation messages
- Empty states
- Confirmation dialogs
- Error messages
- Settings
- Notification content
- Financial labels
- Prayer names and settings descriptions

Requirements:

- English is the initial default language.
- The user can switch to Bangla.
- The language preference persists across restarts.
- The language can be changed without reinstalling the app.
- Bangla labels must render correctly.
- Currency and dates should use appropriate locale-aware formatting.
- Database values must not be translated in a way that corrupts stored data.
- Stable internal codes should be separated from translated labels.

Test layouts for long Bangla strings.

Use a Bengali-capable font if the desired typeface is not reliably available on the target Android device.

---

# 10. Security and Privacy

Jibon contains financial, family, and health information.

Security must be designed into the application.

## App lock

Implement:

- First-run lock setup
- App-specific PIN
- PIN confirmation
- Optional biometric unlock
- PIN fallback
- Lock on app restart
- Configurable background timeout
- Authentication cancellation handling
- Failed-attempt protection
- Safe recovery guidance

Never store the raw PIN.

Do not rely on a hardcoded PIN.

Do not treat a boolean in ordinary React state as a complete security boundary.

Prevent sensitive navigation from being rendered before authentication succeeds.

Handle Android lifecycle transitions correctly.

## Secure storage

Use platform secure storage for suitable secrets and key material.

Do not store secrets in:

- Source code
- Plain-text settings
- Exported logs
- Debug output
- Analytics events

## Database encryption

Investigate SQLCipher or another appropriately maintained encrypted database implementation compatible with the chosen Expo configuration.

Document the selected encryption method, key management, installation requirements, and limitations.

Do not claim that SQLite is encrypted simply because the application has an app lock.

## Sensitive information

Protect:

- Account balances and transaction details
- Family contact information
- Medicine schedules
- Health notes
- Personal documents

Avoid unnecessary collection of personal data.

Never request banking passwords, PINs for external financial accounts, or other unnecessary authentication secrets.

## Threat model

Document realistic threats, including:

- A person opening the app on an unlocked phone
- Unauthorized access to local application files
- Lost or stolen devices
- Exposure through backups
- Accidental destructive operations
- Malformed imported backup files
- Logging sensitive data during development

Explain what the chosen security controls do and do not protect against.

---

# 11. Manual Backup and Restore

Implement a complete manual backup and restoration system.

A backup must contain all supported user-created data and the schema or format version needed for restoration.

Suggested logical structure:

{
  "format": "jibon-backup",
  "version": 1,
  "createdAt": "ISO-8601 timestamp",
  "appVersion": "application version",
  "data": {}
}

The actual exported format may be a JSON envelope containing encrypted payload bytes and cryptographic metadata.

## Backup requirements

- Export all relevant tables.
- Preserve relationships and identifiers.
- Include the format version.
- Use authenticated encryption.
- Derive the encryption key from a separate user-supplied backup password using an appropriate password-based key derivation function.
- Use a cryptographically secure random salt and nonce.
- Store the salt, nonce, and authentication tag as required by the encryption format.
- Never include the raw password or secret encryption key.
- Write the resulting file through a supported document or file API.
- Clearly report success or failure.

## Restore requirements

- Let the user select a backup file.
- Validate its format and version.
- Request the backup password.
- Authenticate and decrypt before trusting its contents.
- Validate record types, relationships, sizes, and required fields.
- Reject malformed or unsupported files safely.
- Show a preview of what will be restored.
- Explain whether restoration replaces existing records or merges them.
- Use an explicit user confirmation.
- Restore inside a database transaction wherever feasible.
- Preserve the existing data if restoration fails.
- Handle duplicate IDs and conflicting records deterministically.

For the first release, prefer a **replace-all restore with a clear warning and a pre-restore safety backup**, rather than attempting a complicated merge algorithm.

Test a complete backup-and-restore cycle on a fresh installation.

Never claim the backup is secure until the encryption implementation and recovery tests pass.

---

# 12. Error Handling and Data Integrity

Implement a consistent error-handling strategy.

Examples:

- Database initialization failure
- Failed insert or update
- Invalid user input
- Duplicate payment
- Invalid transaction amount
- Missing account
- Invalid date
- Corrupt backup
- Incorrect backup password
- Notification permission denied
- Unsupported biometric authentication
- Failed restore
- Unexpected application exception

User-facing messages should be concise and understandable.

Developer diagnostics may include technical details, but must not expose secrets or sensitive personal data.

Use transactions for:

- Account transfers
- Bill payments that create expenses
- Grocery purchases linked to expenses
- Related family and task operations
- Multi-table backup restoration

Validate monetary amounts before saving.

Reject zero or negative transaction amounts where not permitted.

Prevent duplicate operations when the user taps a button multiple times.

Do not optimistically claim an operation succeeded before the database confirms it.

---

# 13. Performance Requirements

Design for thousands of personal records without unnecessary UI or database slowdowns.

Requirements:

- Use indexed queries.
- Avoid loading the entire database for every screen.
- Use pagination or incremental loading where appropriate.
- Use FlatList or an appropriate virtualized list for long lists.
- Avoid repeated full-database queries on every render.
- Use stable React keys.
- Debounce search input where useful.
- Avoid unnecessary global state.
- Calculate financial summaries using appropriate SQL queries or well-defined services.
- Keep database transactions short.
- Do not block the main UI thread with expensive processing.
- Handle large backup files without unnecessary duplication in memory.

Set realistic performance goals and measure them on representative devices rather than claiming untested benchmarks.

---

# 14. Testing Strategy

Use a suitable test framework compatible with the project, such as Jest with React Native Testing Library.

Test business logic independently from screens.

## Unit tests

Cover:

- Task validation
- Task status transitions
- Transaction calculations
- Account balance calculations
- Transfers
- Monthly summaries
- Budget calculations
- Bill recurrence
- Duplicate-payment prevention
- Date handling
- Localization fallback
- Backup format validation

## Database tests

Verify:

- Database initialization
- Migration execution
- Foreign key constraints
- CRUD operations
- Correct transaction rollback
- Correct financial calculations
- Persistent data after reopening
- Archive and delete behavior
- Backup restoration integrity

## UI tests

Verify:

- Empty states
- Form validation
- Adding and completing tasks
- Editing records
- Destructive-action confirmation
- Language switching
- Authentication navigation
- Error feedback

## Offline tests

Test the application with network connectivity disabled.

Verify that:

- Existing records remain available.
- New records can be created.
- Records can be edited and deleted.
- Search and reports work.
- Prayer configuration remains accessible.
- Reminders are scheduled where Android permits.
- Restarting the app does not erase records.

## Security tests

Verify:

- PINs are not stored as plain text.
- Authentication failures do not expose protected screens.
- Backup files cannot be modified without detection.
- Wrong backup passwords are rejected.
- Invalid backups do not corrupt existing records.
- Logs do not contain sensitive information.

## Financial correctness tests

Create explicit tests for:

1. Opening balance plus income.
2. Expense reducing the correct account.
3. Transfer reducing one account and increasing another.
4. Transfer excluded from income and expense reports.
5. Monthly date boundaries.
6. Editing and deleting a transaction.
7. Bill payment recorded exactly once.
8. Refund handling.
9. Budget calculation.
10. Currency formatting.

Do not consider the finance module complete until these tests pass.

---

# 15. Implementation Phases

Implement the app in clearly defined phases.

Do not attempt to generate the entire application in one enormous, untested code change.

## Phase 0: Repository inspection and planning

- Inspect the existing repository.
- Determine the installed Node.js, Expo, React Native, and TypeScript versions.
- Inspect package.json and the generated navigation structure.
- Identify existing reusable components.
- Create docs/architecture.md.
- Create docs/database-schema.md.
- Create docs/security.md.
- Write an implementation checklist.
- Identify compatibility constraints before installing dependencies.

Do not overwrite a working project with a new template without justification.

## Phase 1: Project foundation

- Configure Expo Router.
- Configure TypeScript strict mode.
- Create the basic theme and design tokens.
- Configure SQLite.
- Implement database initialization and migrations.
- Create the task repository.
- Create the task service.
- Build a working Tasks screen.
- Add, edit, complete, reopen, and delete tasks.
- Test persistence after app restart.

**Completion criterion:** the task feature works on Android with no network connection and survives app restarts.

## Phase 2: Localization and application shell

- Implement English and Bangla translation files.
- Add language selection.
- Persist language preference.
- Build the bottom navigation.
- Build reusable form and card components.
- Implement empty, loading, and error states.
- Add the dashboard layout.

**Completion criterion:** all implemented UI is localizable and navigable.

## Phase 3: App lock and security foundation

- Implement first-run security setup.
- Implement PIN verification.
- Add optional biometrics.
- Implement lock-state management.
- Configure database encryption.
- Review secret storage.
- Test app lifecycle behavior.
- Document security limitations.

**Completion criterion:** authentication is tested, protected screens are gated, and the database's encryption status is explicitly verified.

## Phase 4: Notes and personal records

- Implement notes.
- Implement categories and tags.
- Implement search.
- Add record timestamps.
- Add safe deletion and editing.
- Integrate notes into the dashboard.

**Completion criterion:** notes remain persistent and searchable offline.

## Phase 5: Finance

Implement in this order:

1. Accounts.
2. Opening balances.
3. Income transactions.
4. Expense transactions.
5. Transaction history.
6. Account balance calculation.
7. Transfers.
8. Categories.
9. Monthly summaries.
10. Budgets.
11. Reports.

**Completion criterion:** balances and reports are correct, tested, and derived from stored transactions.

## Phase 6: Bills and household finances

- Bill definitions.
- Bill occurrences.
- Payment history.
- Recurrence rules.
- Payment reminders.
- Expense integration.
- Duplicate-payment prevention.

**Completion criterion:** each payment is represented correctly in history and finance reports.

## Phase 7: Family and groceries

- Family member CRUD.
- Family request management.
- Request priorities and deadlines.
- Grocery lists.
- Grocery items.
- Purchased-item tracking.
- Optional linked expenses.
- Dashboard integration.

**Completion criterion:** family requests and shopping lists can be managed entirely on one device.

## Phase 8: Prayer and health

- Prayer calculation configuration.
- Prayer schedule caching.
- Prayer completion logs.
- Medicine records.
- Medicine schedules.
- Dose logs.
- Appointments.
- Local reminders.

**Completion criterion:** users can access their configured schedules offline and manage reminders without relying on a remote backend.

## Phase 9: Backup and restoration

- Backup serialization.
- Authenticated encryption.
- Backup file creation.
- File selection.
- Backup validation.
- Restore preview.
- Transactional restoration.
- Pre-restore safety backup.
- Recovery testing.

**Completion criterion:** a complete backup can be restored successfully, including relationships and timestamps, on a clean installation.

## Phase 10: Quality assurance and Android release

- Run TypeScript checks.
- Run linting.
- Run unit tests.
- Run database tests.
- Test offline behavior.
- Test on a physical Android device.
- Verify notification permissions.
- Test font rendering in Bangla.
- Verify database encryption.
- Test backup and restore.
- Test Android app lifecycle behavior.
- Produce a release build.
- Document installation and recovery procedures.

**Completion criterion:** the app builds, core workflows work offline, and all documented critical tests pass.

---

# 16. Initial Working Feature: Tasks

Begin by implementing one complete vertical slice rather than creating empty files for every module.

The first feature must include:

- SQLite initialization.
- A tasks table.
- Database migrations.
- Task types.
- Task repository.
- Task service.
- Tasks screen.
- Add-task form.
- Task list.
- Complete/reopen action.
- Delete confirmation.
- Input validation.
- Loading state.
- Empty state.
- Error handling.
- Persistent storage.

Suggested task fields:

- id
- title
- description
- due_at
- priority
- status
- created_at
- updated_at
- completed_at

Use stable IDs generated by a reliable ID generator.

Use ISO-8601 timestamps consistently.

Use parameterized SQL.

Avoid putting all database operations inside the screen component.

### Initial acceptance tests

The first feature is accepted only when:

1. The app opens.
2. A user can add a task.
3. The task appears in the list.
4. The user can mark it complete.
5. The user can reopen it.
6. The user can delete it after confirmation.
7. Empty titles are rejected.
8. Data remains after the app restarts.
9. Core task operations work offline.
10. Database failures produce an error message.
11. The TypeScript compiler reports no errors introduced by the feature.
12. The app can be launched on the target Android environment.

Do not move on to the financial module until this feature is working.

---

# 17. Engineering Rules

Follow these rules throughout development.

1. Inspect existing files before editing them.
2. Prefer small, verifiable changes.
3. Keep TypeScript strict.
4. Avoid `any` unless there is a documented reason.
5. Never put secrets in source code.
6. Never hardcode financial balances or dashboard statistics.
7. Never use floating-point values as the canonical monetary representation.
8. Never concatenate user input into SQL.
9. Never silently discard user data.
10. Never delete important financial history as a side effect of deleting an account.
11. Never count account transfers as income or expenses.
12. Never mark a medicine dose taken merely because a reminder fired.
13. Never treat a local bill-payment record as proof of external payment.
14. Never claim a feature is implemented when it is only a placeholder.
15. Never claim tests passed without running them.
16. Do not suppress TypeScript errors just to make the build pass.
17. Do not add unnecessary backend services.
18. Do not introduce complex abstractions without a concrete benefit.
19. Use database migrations for schema evolution.
20. Document important architecture decisions.
21. Keep UI strings out of components when they should be translated.
22. Preserve accessibility and keyboard usability.
23. Handle loading, empty, success, and error states.
24. Keep sensitive data out of logs.
25. Explain native build requirements clearly.
26. Prefer official documentation when package APIs are uncertain.
27. Do not downgrade Expo or React Native versions blindly.
28. Do not rewrite unrelated files while implementing a feature.
29. Ask a focused clarification question only when an unresolved decision blocks safe implementation.
30. If a decision is noncritical, choose a sensible default and document it.

---

# 18. Developer Documentation

Maintain the following documentation as the project evolves:

- README.md: setup, commands, and project overview.
- docs/architecture.md: application layers and dependencies.
- docs/database-schema.md: tables, relationships, and migrations.
- docs/security.md: app lock, database encryption, and key management.
- docs/backup-restore.md: backup format and recovery procedure.
- docs/testing.md: test commands and coverage.
- docs/implementation-status.md: implemented, in-progress, and pending features.

Update the documentation when architecture or important behavior changes.

Do not claim production readiness merely because the app compiles.

---

# 19. Final Definition of Done

Jibon's MVP is complete when:

- It installs and runs on Android.
- It works offline for all core local features.
- It uses SQLite as the persistent source of truth.
- It supports tasks, notes, finance, bills, family requests, groceries, prayer tracking, and medicine records.
- It supports English and Bangla.
- It has a tested app-lock flow.
- Its database-encryption status is verified and documented.
- It supports manual encrypted backup and restoration.
- Its financial calculations pass explicit correctness tests.
- Its reminders use local notification mechanisms.
- It has safe database migrations.
- It has clear error handling.
- It has no hardcoded production dashboard metrics.
- It has a maintainable feature-based structure.
- Critical workflows are tested on Android.
- The documentation accurately reflects the implementation.

If a requirement cannot be completed because of an Expo SDK limitation, missing dependency, native configuration issue, or unavailable test environment, document the limitation and the precise next step. Do not fake the behavior.

---

# 20. Instructions for Starting Work Now

Start with Phase 0 and Phase 1 only.

Follow this execution sequence:

1. Inspect the repository and existing configuration.
2. Summarize the current state.
3. Identify the minimum required dependency changes.
4. Create or update the architecture and database documentation.
5. Implement SQLite initialization and migrations.
6. Implement the task repository and service.
7. Implement the Tasks screen.
8. Run the available TypeScript, lint, and test commands.
9. Fix the issues introduced by your changes.
10. Verify the actual Android launch path when the environment permits.
11. Update docs/implementation-status.md.
12. Report exactly what was implemented, what was tested, what passed, and what remains incomplete.

Do not implement every module during the first pass.

Do not stop after producing a plan if you have access to a coding environment.

Make the first task feature genuinely functional, persistent, and offline-capable.

Once Phase 1 passes its acceptance criteria, continue to Phase 2 in a separate, verifiable implementation step.

**The ultimate goal is a reliable personal operating system for everyday life: private, offline-first, secure, maintainable, bilingual, and useful enough to become the user's central place for managing life.**