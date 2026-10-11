/**
 * Minimal async SQL interface used by repositories and the migration runner.
 *
 * Production code binds this to a real `expo-sqlite` connection (which is
 * structurally compatible). Tests bind it to an adapter over Node's built-in
 * `node:sqlite`, so the exact same SQL runs against a real SQLite engine
 * without a device. Keeping repositories typed against this interface — not
 * against expo-sqlite — is what makes that possible.
 */

export type SqlParam = string | number | null;

export interface SqlRunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface SqlDatabase {
  /** Executes one or more statements with no parameters. */
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: SqlParam[]): Promise<SqlRunResult>;
  getAllAsync<T>(source: string, params?: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params?: SqlParam[]): Promise<T | null>;
  /**
   * Runs `task` inside a transaction so that no other query can interleave
   * with it. Native connections run it on a dedicated connection; on web
   * (where expo-sqlite has no exclusive transactions) it falls back to a
   * plain transaction on the same connection.
   */
  withExclusiveTransactionAsync(task: (txn: SqlDatabase) => Promise<void>): Promise<void>;
}

/**
 * Escapes `%`, `_`, and `\` so a user-typed search string is matched
 * literally inside a `LIKE ? ESCAPE '\'` pattern.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
