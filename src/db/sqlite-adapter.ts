import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { SqlDatabase, SqlParam } from './sql';

/**
 * Adapts a real expo-sqlite connection to the minimal `SqlDatabase`
 * interface. expo-sqlite's overloaded bind-parameter signatures are not
 * structurally assignable to the simplified interface, so this explicit
 * adapter (type-only dependency on expo-sqlite) bridges the two.
 */
export function toSqlDatabase(db: SQLiteDatabase): SqlDatabase {
  return {
    execAsync: (source) => db.execAsync(source),
    runAsync: (source, params) => db.runAsync(source, normalizeParams(params)),
    getAllAsync: <T>(source: string, params?: SqlParam[]) =>
      db.getAllAsync<T>(source, normalizeParams(params)),
    getFirstAsync: <T>(source: string, params?: SqlParam[]) =>
      db.getFirstAsync<T>(source, normalizeParams(params)),
    withExclusiveTransactionAsync: (task) => {
      if (Platform.OS === 'web') {
        // expo-sqlite's web build (wa-sqlite) has no exclusive transactions;
        // a plain transaction on the same connection is the closest
        // equivalent. Safe here because the migration runner is the only
        // caller and it runs before any other query is issued.
        return db.withTransactionAsync(() => task(toSqlDatabase(db)));
      }
      return db.withExclusiveTransactionAsync((txn) => task(toSqlDatabase(txn)));
    },
  };
}

function normalizeParams(params?: SqlParam[]): (string | number | null)[] {
  return params ?? [];
}
