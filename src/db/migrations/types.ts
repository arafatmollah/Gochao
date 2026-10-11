import type { SqlDatabase } from '../sql';

export interface Migration {
  /** Monotonic schema version; stored in `PRAGMA user_version`. */
  version: number;
  /** Human-readable name shown in diagnostics and documentation. */
  name: string;
  /** Applies the migration. Runs inside an exclusive transaction. */
  up: (db: SqlDatabase) => Promise<void>;
}
