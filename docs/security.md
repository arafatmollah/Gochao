# Jibon — Security & Privacy

Status: **Phase 1 only.** The app lock, PIN storage, and database encryption described below are
**not implemented yet** (they are Phase 3), and the backup/restore crypto is **not implemented yet**
(Phase 9). This document separates *what exists today* from *what is planned*, and never claims a
control exists before it is implemented and tested.

## Current state (verified)

| Control | Status |
| --- | --- |
| App lock / PIN | Not implemented |
| Biometric unlock | Not implemented |
| Database encryption (SQLCipher) | Not enabled — the SQLite file is currently plaintext in the app sandbox |
| Secure storage of secrets | No secrets exist yet to store |
| Network access | The app has no network code, no analytics, no telemetry. Nothing leaves the device |
| Logging of sensitive data | Enforced by policy in code: `toUserMessage()` logs only in `__DEV__` and never includes record contents (`src/utils/errors.ts`) |

**Do not claim the database is encrypted.** An app-level PIN (when added) is an access gate for the
UI, not encryption of the data at rest.

## Data inventory (present and planned)

Stored locally in SQLite (`jibon.db`) inside the app sandbox:

- Present: tasks (title, description, due date, priority, completion state).
- Planned: notes, accounts/transactions/balances, bills, family contact details, grocery lists,
  medicine schedules and dose logs, appointments, health records, prayer logs.

All of this is personal data; some is sensitive (finance, health, family contacts).

## App lock plan (Phase 3 — not implemented)

Design constraints from the master prompt (§10):

- First-run PIN setup with confirmation; the raw PIN is **never stored** and never hardcoded.
- Store a random salt + derived verifier in platform secure storage
  (`expo-secure-store`, Android Keystore-backed). Compare in constant time.
- Lock on app restart; configurable background timeout; Android lifecycle handled explicitly.
- Failed-attempt protection (increasing delay / attempt counters) without destroying data.
- Biometric unlock (optional, e.g. `expo-local-authentication`) always falls back to PIN.
- Sensitive routes are not rendered before authentication succeeds — the gate lives in the root
  layout / navigation, not in a boolean that merely hides UI. A boolean in React state is not
  treated as a security boundary.

**Open decision — PIN KDF.** `expo-crypto` (already installed) provides hashing (`digest`),
CSPRNG (`getRandomBytes`), and AES — but **no password-based KDF** (no PBKDF2/scrypt/Argon2). Phase
3 must pick one and justify it, e.g.:

1. A maintained pure-JS KDF library (e.g. `@noble/hashes` — supports pbkdf2/scrypt/argon2; audited,
   but pure-JS iteration cost on Hermes must be measured against a UI budget), or
2. PBKDF2 composed from `expo-crypto` primitives (HMAC built on `digest`; more native-bridge calls,
   needs benchmarking), or
3. A native KDF module (fastest; adds a native dependency and dev-build requirement).

Whatever is chosen must have: per-PIN random salt, a high iteration/parameter count appropriate for
a 4–6 digit PIN (a short PIN is low-entropy; the KDF exists to make offline guessing expensive), and
a unit test proving the verifier never equals the PIN and that verification is stable.

## Database encryption plan (Phase 3 — not implemented)

Verified findings (Expo SDK 57):

- `expo-sqlite` supports **SQLCipher** through its config plugin option `useSQLCipher: true`
  (SQLCipher is built into the native module when this flag is on).
- **This requires a development build** (`npx expo prebuild` + `npx expo run:android`, or an EAS
  dev build). **Expo Go cannot use SQLCipher** — the flag changes native compilation.
- With SQLCipher enabled, the key is supplied when opening the database
  (`SQLiteProvider`/`openDatabaseAsync` accept the key); the app code must therefore route all
  opens through `initializeDatabase()` so there is exactly one place the key is applied.

Planned key management:

- Generate a 256-bit random key with `Crypto.getRandomBytes(32)` on first run.
- Store it in `expo-secure-store` (Android Keystore-backed), **never** in SQLite, settings, source,
  or logs.
- Decision to document when implemented: whether the DB key is wrapped by the PIN KDF output or
  independent of it. Trade-offs: PIN-wrapping ties unlock to the key but makes PIN loss
  catastrophic (data unrecoverable); an independent key means device-level theft resistance only.
  Whichever is chosen must be written down here with its consequences.

**Ordering constraint:** enable encryption **before** real user data exists, or plan an explicit
re-encryption path (`sqlcipher_export` or encrypted export/import). Flipping the flag on an
existing plaintext database does not encrypt it.

Verification requirement (Phase 3 completion criterion): on a physical device, confirm the
on-disk `jibon.db` is not readable as SQLite without the key (e.g. open the DB file bytes off-device
and observe they are not a plaintext SQLite header), and that the app still launches, migrates, and
persists through a restart. Until that verification passes, the status remains "not encrypted".

## Secure storage rules

- Secrets (PIN verifier salt, DB key, any future tokens) live **only** in `expo-secure-store`.
- Secrets never go into: source code, `app_settings`, logs, debug output, error messages, or
  analytics (no analytics exists).
- `app_settings` is for non-secret preferences only (e.g. language).

## Threat model

Threats from the product spec (§10), with the planned control and its honest limits:

| Threat | Planned / current control | What it does *not* protect against |
| --- | --- | --- |
| Someone opens the app on an unlocked phone | PIN/biometric gate before sensitive screens render; background lock | Someone who knows the PIN; screenshots/recents thumbnails unless separately mitigated |
| Unauthorized access to app files (e.g. via backup extraction of an unlocked/rooted device) | SQLCipher database encryption (Phase 3) | Devices where the attacker can extract secure storage keys (root, compromised OS); data already shown on screen |
| Lost or stolen device | Device lock + app lock + possibly DB encryption at rest | Theft with an unlocked device and known PIN |
| Exposure through exported backups | Encrypted backups with authenticated encryption (Phase 9) | Weak user-chosen backup passwords; backups stored alongside their passwords |
| Accidental destructive operations | Confirmation dialogs for deletes; replace-all restore requires explicit warning + pre-restore safety backup | User confirming a destructive action deliberately |
| Malformed / malicious imported backup | Format+version validation, authenticated decryption before trust, size/field validation, restore inside a transaction, reject safely | Crafted files that are validly encrypted with a known password |
| Sensitive data leaking via development logs | `__DEV__`-only logging of generic messages; record contents never logged | Attached debuggers on a dev build |

Explicit non-goals at MVP: protection against a malicious OS/keyboard, screen-capture prevention,
and hardware-level attacks are out of scope and will be documented as such if the user asks for
them.

## Backup encryption plan (Phase 9 — not implemented)

Format (spec §11): a JSON envelope, e.g.
`{ "format": "jibon-backup", "version": 1, "createdAt": "...", "appVersion": "...", "kdf": {...},
"cipher": "AES-256-GCM", "salt": "...", "iv": "...", "tag": "...", "ciphertext": "..." }`.

Plan, using verified capabilities of already-installed `expo-crypto`:

- **KDF for the backup password**: same open decision as the PIN KDF above; salt from
  `Crypto.getRandomBytes`. The spec requires "an appropriate password-based key derivation
  function"; a library choice is required because expo-crypto has none built in.
- **AEAD**: `aesEncryptAsync` / `aesDecryptAsync` from `expo-crypto` — AES-GCM sealed data
  (`AESSealedData` carries iv, ciphertext, and authentication tag; GCM tag length is configurable,
  default 16 bytes). Decryption authenticates before the payload is trusted; a wrong password or
  tampered file fails the tag check.
- **Randomness**: `Crypto.getRandomBytes` for salt and nonce (CSPRNG).
- Never include the raw password or the derived key in the file. The derived key is zeroed/not
  persisted.
- Restore flow: select file → validate format/version → ask password → decrypt+authenticate →
  validate records/relationships/sizes → preview → explicit confirm → transactional replace-all
  restore with a **pre-restore safety backup** → report success/failure. Failures leave existing
  data untouched.
- **Testing gate:** a full backup → wipe → restore cycle on a clean install, plus wrong-password
  and tampered-file tests. Until those pass, the backup feature must not be described as secure or
  complete.

## Operational rules (all phases)

- Never request banking passwords, external account PINs, or other third-party secrets.
- Never hardcode a PIN, key, or balance.
- Never log record contents; error messages to users stay generic
  (`toUserMessage()`), technical detail stays behind `__DEV__` without secrets.
- Database migrations are the only schema change mechanism; no ad-hoc DDL at runtime.
- A successful UI update is never treated as proof a database write succeeded — SQLite is the
  source of truth.
