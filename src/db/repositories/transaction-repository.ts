import type {
  ActivityFilter,
  ActivityKind,
  ActivityRow,
  CategoryTotal,
  MonthNetItem,
  Transaction,
  TransactionKind,
} from '@/types/finance';

import { escapeLikePattern, type SqlDatabase, type SqlParam } from '../sql';

interface TransactionRow {
  id: string;
  kind: TransactionKind;
  amount_minor: number;
  account_id: string;
  category_id: string;
  occurred_on: string;
  description: string;
  recipient: string | null;
  notes: string | null;
  bill_occurrence_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ActivityDbRow {
  id: string;
  kind: ActivityKind;
  amount_minor: number;
  occurred_on: string;
  description: string | null;
  account_id: string;
  account_name: string;
  to_account_id: string | null;
  to_account_name: string | null;
  category_id: string | null;
  category_name: string | null;
  category_is_builtin: number | null;
  notes: string | null;
  bill_occurrence_id: string | null;
  created_at: string;
}

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    kind: row.kind,
    amountMinor: row.amount_minor,
    accountId: row.account_id,
    categoryId: row.category_id,
    occurredOn: row.occurred_on,
    description: row.description,
    recipient: row.recipient,
    notes: row.notes,
    billOccurrenceId: row.bill_occurrence_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivityRow(row: ActivityDbRow): ActivityRow {
  return {
    id: row.id,
    kind: row.kind,
    amountMinor: row.amount_minor,
    occurredOn: row.occurred_on,
    description: row.description,
    accountId: row.account_id,
    accountName: row.account_name,
    toAccountId: row.to_account_id,
    toAccountName: row.to_account_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryIsBuiltin: row.category_is_builtin === 1,
    notes: row.notes,
    billOccurrenceId: row.bill_occurrence_id,
    createdAt: row.created_at,
  };
}

const TRANSACTION_COLUMNS = `
  id, kind, amount_minor, account_id, category_id, occurred_on, description,
  recipient, notes, bill_occurrence_id, created_at, updated_at
`;

export const DEFAULT_ACTIVITY_LIMIT = 200;

/**
 * Shared INSERT used by `SqliteTransactionRepository` and, inside the bill
 * payment transaction, by `SqliteBillRepository` — the expense a bill payment
 * creates must be written through the same statement everywhere.
 */
export async function insertTransactionRow(db: SqlDatabase, transaction: Transaction): Promise<void> {
  await db.runAsync(
    `INSERT INTO transactions (
       id, kind, amount_minor, account_id, category_id, occurred_on, description,
       recipient, notes, bill_occurrence_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      transaction.id,
      transaction.kind,
      transaction.amountMinor,
      transaction.accountId,
      transaction.categoryId,
      transaction.occurredOn,
      transaction.description,
      transaction.recipient,
      transaction.notes,
      transaction.billOccurrenceId,
      transaction.createdAt,
      transaction.updatedAt,
    ],
  );
}

export interface TransactionRepository {
  insert(transaction: Transaction): Promise<void>;
  update(transaction: Transaction): Promise<void>;
  findById(id: string): Promise<Transaction | null>;
  delete(id: string): Promise<boolean>;
  /**
   * Unified income/expense/transfer feed, newest first. Transfers are
   * separate rows with their own kind, so totals never absorb them.
   */
  listActivity(filter?: ActivityFilter): Promise<ActivityRow[]>;
  /**
   * Income and expense sums for the same filters the list uses (the `kind`
   * filter is intentionally ignored: the UI shows both this-month figures
   * next to the filtered list). Transfers are excluded by construction.
   */
  sumActivity(filter?: ActivityFilter): Promise<{ incomeMinor: number; expenseMinor: number }>;
  /** Expense (or income) totals grouped by category, largest first. */
  sumByCategory(options: {
    kind: TransactionKind;
    fromOn: string;
    toOn: string;
  }): Promise<CategoryTotal[]>;
  /** Per-month income/expense totals within [fromOn, nextStartOn). */
  monthTotals(options: { fromOn: string; nextStartOn: string }): Promise<MonthNetItem[]>;
}

export class SqliteTransactionRepository implements TransactionRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(transaction: Transaction): Promise<void> {
    await insertTransactionRow(this.db, transaction);
  }

  async update(transaction: Transaction): Promise<void> {
    await this.db.runAsync(
      `UPDATE transactions
          SET amount_minor = ?, account_id = ?, category_id = ?, occurred_on = ?,
              description = ?, recipient = ?, notes = ?, updated_at = ?
        WHERE id = ?`,
      [
        transaction.amountMinor,
        transaction.accountId,
        transaction.categoryId,
        transaction.occurredOn,
        transaction.description,
        transaction.recipient,
        transaction.notes,
        transaction.updatedAt,
        transaction.id,
      ],
    );
  }

  async findById(id: string): Promise<Transaction | null> {
    const row = await this.db.getFirstAsync<TransactionRow>(
      `SELECT ${TRANSACTION_COLUMNS} FROM transactions WHERE id = ?`,
      [id],
    );
    return row ? mapTransaction(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.runAsync(`DELETE FROM transactions WHERE id = ?`, [id]);
    return result.changes > 0;
  }

  async listActivity(filter: ActivityFilter = {}): Promise<ActivityRow[]> {
    const parts: string[] = [];
    const params: SqlParam[] = [];

    const kind = filter.kind;
    const includeTransactions = kind !== 'transfer';
    const includeTransfers = kind !== 'income' && kind !== 'expense' && !filter.categoryId;

    if (includeTransactions) {
      const conditions: string[] = [];
      if (kind === 'income' || kind === 'expense') {
        conditions.push('t.kind = ?');
        params.push(kind);
      }
      if (filter.accountId) {
        conditions.push('t.account_id = ?');
        params.push(filter.accountId);
      }
      if (filter.categoryId) {
        conditions.push('t.category_id = ?');
        params.push(filter.categoryId);
      }
      if (filter.fromOn) {
        conditions.push('t.occurred_on >= ?');
        params.push(filter.fromOn);
      }
      if (filter.toOn) {
        conditions.push('t.occurred_on <= ?');
        params.push(filter.toOn);
      }
      if (filter.search) {
        const pattern = `%${escapeLikePattern(filter.search)}%`;
        conditions.push(
          `(t.description LIKE ? ESCAPE '\\' OR IFNULL(t.recipient, '') LIKE ? ESCAPE '\\' ` +
            `OR IFNULL(t.notes, '') LIKE ? ESCAPE '\\')`,
        );
        params.push(pattern, pattern, pattern);
      }
      parts.push(`
        SELECT t.id, t.kind, t.amount_minor, t.occurred_on, t.description, t.notes,
               t.account_id, a.name AS account_name,
               NULL AS to_account_id, NULL AS to_account_name,
               t.category_id, c.name AS category_name, c.is_builtin AS category_is_builtin,
               t.bill_occurrence_id, t.created_at
          FROM transactions t
          JOIN accounts a ON a.id = t.account_id
          JOIN categories c ON c.id = t.category_id
         ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      `);
    }

    if (includeTransfers) {
      const conditions: string[] = [];
      if (filter.accountId) {
        conditions.push('(tr.from_account_id = ? OR tr.to_account_id = ?)');
        params.push(filter.accountId, filter.accountId);
      }
      if (filter.fromOn) {
        conditions.push('tr.occurred_on >= ?');
        params.push(filter.fromOn);
      }
      if (filter.toOn) {
        conditions.push('tr.occurred_on <= ?');
        params.push(filter.toOn);
      }
      if (filter.search) {
        const pattern = `%${escapeLikePattern(filter.search)}%`;
        conditions.push(`IFNULL(tr.notes, '') LIKE ? ESCAPE '\\'`);
        params.push(pattern);
      }
      parts.push(`
        SELECT tr.id, 'transfer' AS kind, tr.amount_minor, tr.occurred_on,
               NULL AS description, tr.notes,
               tr.from_account_id AS account_id, fa.name AS account_name,
               tr.to_account_id, ta.name AS to_account_name,
               NULL AS category_id, NULL AS category_name, NULL AS category_is_builtin,
               NULL AS bill_occurrence_id, tr.created_at
          FROM transfers tr
          JOIN accounts fa ON fa.id = tr.from_account_id
          JOIN accounts ta ON ta.id = tr.to_account_id
         ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      `);
    }

    if (parts.length === 0) {
      return [];
    }

    const limit = filter.limit ?? DEFAULT_ACTIVITY_LIMIT;
    const offset = filter.offset ?? 0;
    const rows = await this.db.getAllAsync<ActivityDbRow>(
      `SELECT * FROM (${parts.join(' UNION ALL ')}) AS activity
        ORDER BY activity.occurred_on DESC, activity.created_at DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map(mapActivityRow);
  }

  async sumActivity(
    filter: ActivityFilter = {},
  ): Promise<{ incomeMinor: number; expenseMinor: number }> {
    const conditions: string[] = [];
    const params: SqlParam[] = [];
    if (filter.accountId) {
      conditions.push('t.account_id = ?');
      params.push(filter.accountId);
    }
    if (filter.categoryId) {
      conditions.push('t.category_id = ?');
      params.push(filter.categoryId);
    }
    if (filter.fromOn) {
      conditions.push('t.occurred_on >= ?');
      params.push(filter.fromOn);
    }
    if (filter.toOn) {
      conditions.push('t.occurred_on <= ?');
      params.push(filter.toOn);
    }
    if (filter.search) {
      const pattern = `%${escapeLikePattern(filter.search)}%`;
      conditions.push(
        `(t.description LIKE ? ESCAPE '\\' OR IFNULL(t.recipient, '') LIKE ? ESCAPE '\\' ` +
          `OR IFNULL(t.notes, '') LIKE ? ESCAPE '\\')`,
      );
      params.push(pattern, pattern, pattern);
    }
    const row = await this.db.getFirstAsync<{
      income_minor: number;
      expense_minor: number;
    }>(
      `SELECT
         IFNULL(SUM(CASE WHEN t.kind = 'income' THEN t.amount_minor ELSE 0 END), 0)
           AS income_minor,
         IFNULL(SUM(CASE WHEN t.kind = 'expense' THEN t.amount_minor ELSE 0 END), 0)
           AS expense_minor
       FROM transactions t
       ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}`,
      params,
    );
    return {
      incomeMinor: row?.income_minor ?? 0,
      expenseMinor: row?.expense_minor ?? 0,
    };
  }

  async sumByCategory(options: {
    kind: TransactionKind;
    fromOn: string;
    toOn: string;
  }): Promise<CategoryTotal[]> {
    const rows = await this.db.getAllAsync<{
      category_id: string;
      category_name: string;
      category_is_builtin: number;
      total_minor: number;
    }>(
      `SELECT t.category_id, c.name AS category_name,
              c.is_builtin AS category_is_builtin,
              SUM(t.amount_minor) AS total_minor
         FROM transactions t
         JOIN categories c ON c.id = t.category_id
        WHERE t.kind = ?
          AND t.occurred_on >= ? AND t.occurred_on <= ?
        GROUP BY t.category_id
        ORDER BY total_minor DESC, c.name COLLATE NOCASE ASC`,
      [options.kind, options.fromOn, options.toOn],
    );
    return rows.map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      categoryIsBuiltin: row.category_is_builtin === 1,
      totalMinor: row.total_minor,
    }));
  }

  async monthTotals(options: { fromOn: string; nextStartOn: string }): Promise<MonthNetItem[]> {
    const rows = await this.db.getAllAsync<{
      month_key: string;
      income_minor: number;
      expense_minor: number;
    }>(
      `SELECT substr(occurred_on, 1, 7) AS month_key,
              IFNULL(SUM(CASE WHEN kind = 'income' THEN amount_minor ELSE 0 END), 0)
                AS income_minor,
              IFNULL(SUM(CASE WHEN kind = 'expense' THEN amount_minor ELSE 0 END), 0)
                AS expense_minor
         FROM transactions
        WHERE occurred_on >= ? AND occurred_on < ?
        GROUP BY month_key
        ORDER BY month_key ASC`,
      [options.fromOn, options.nextStartOn],
    );
    return rows.map((row) => ({
      monthKey: row.month_key,
      incomeMinor: row.income_minor,
      expenseMinor: row.expense_minor,
      netMinor: row.income_minor - row.expense_minor,
    }));
  }
}
