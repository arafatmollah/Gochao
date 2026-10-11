import type { Account, AccountType, AccountWithBalance } from '@/types/finance';

import type { SqlDatabase } from '../sql';

interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  opening_balance_minor: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

type AccountWithBalanceRow = AccountRow & {
  balance_minor: number;
  transaction_count: number;
  transfer_count: number;
};

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    openingBalanceMinor: row.opening_balance_minor,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAccountWithBalance(row: AccountWithBalanceRow): AccountWithBalance {
  return {
    ...mapAccount(row),
    balanceMinor: row.balance_minor,
    transactionCount: row.transaction_count,
    transferCount: row.transfer_count,
  };
}

const ACCOUNT_COLUMNS =
  'a.id, a.name, a.type, a.currency, a.opening_balance_minor, a.is_archived, ' +
  'a.created_at, a.updated_at';

/**
 * Account balance = opening balance + income − expenses + incoming
 * transfers − outgoing transfers (master prompt Module D). Transfers are a
 * separate table, so they can never leak into income/expense sums; here they
 * are subtracted/added exactly once on the correct side.
 */
const BALANCE_EXPRESSION = `
  (a.opening_balance_minor
    + IFNULL((
        SELECT SUM(CASE WHEN t.kind = 'income' THEN t.amount_minor ELSE -t.amount_minor END)
          FROM transactions t
         WHERE t.account_id = a.id
      ), 0)
    + IFNULL((
        SELECT SUM(tr.amount_minor) FROM transfers tr
         WHERE tr.to_account_id = a.id
      ), 0)
    - IFNULL((
        SELECT SUM(tr.amount_minor) FROM transfers tr
         WHERE tr.from_account_id = a.id
      ), 0)) AS balance_minor
`;

const USAGE_EXPRESSIONS = `
  (SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id) AS transaction_count,
  (SELECT COUNT(*) FROM transfers tr
    WHERE tr.from_account_id = a.id OR tr.to_account_id = a.id) AS transfer_count
`;

export interface AccountRepository {
  insert(account: Account): Promise<void>;
  update(account: Account): Promise<void>;
  findById(id: string): Promise<Account | null>;
  /** Case-insensitive duplicate check for the unique account name. */
  findByName(name: string): Promise<Account | null>;
  list(options?: { includeArchived?: boolean }): Promise<Account[]>;
  /** Accounts with derived balances; active rows first, then by name. */
  listWithBalances(options?: { includeArchived?: boolean }): Promise<AccountWithBalance[]>;
  /**
   * Deletes an account only when no transaction or transfer references it
   * (history is never destroyed by deleting an account — rule 10). Returns
   * false when the account does not exist or is in use.
   */
  deleteIfUnused(id: string): Promise<boolean>;
}

export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(account: Account): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO accounts (
         id, name, type, currency, opening_balance_minor, is_archived,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.name,
        account.type,
        account.currency,
        account.openingBalanceMinor,
        account.isArchived ? 1 : 0,
        account.createdAt,
        account.updatedAt,
      ],
    );
  }

  async update(account: Account): Promise<void> {
    await this.db.runAsync(
      `UPDATE accounts
          SET name = ?, type = ?, currency = ?, opening_balance_minor = ?,
              is_archived = ?, updated_at = ?
        WHERE id = ?`,
      [
        account.name,
        account.type,
        account.currency,
        account.openingBalanceMinor,
        account.isArchived ? 1 : 0,
        account.updatedAt,
        account.id,
      ],
    );
  }

  async findById(id: string): Promise<Account | null> {
    const row = await this.db.getFirstAsync<AccountRow>(
      `SELECT ${ACCOUNT_COLUMNS} FROM accounts a WHERE a.id = ?`,
      [id],
    );
    return row ? mapAccount(row) : null;
  }

  async findByName(name: string): Promise<Account | null> {
    const row = await this.db.getFirstAsync<AccountRow>(
      `SELECT ${ACCOUNT_COLUMNS}
         FROM accounts a
        WHERE a.name = ? COLLATE NOCASE`,
      [name],
    );
    return row ? mapAccount(row) : null;
  }

  async list(options: { includeArchived?: boolean } = {}): Promise<Account[]> {
    const where = options.includeArchived ? '' : 'WHERE a.is_archived = 0';
    const rows = await this.db.getAllAsync<AccountRow>(
      `SELECT ${ACCOUNT_COLUMNS}
         FROM accounts a ${where}
        ORDER BY a.is_archived ASC, a.name COLLATE NOCASE ASC`,
    );
    return rows.map(mapAccount);
  }

  async listWithBalances(
    options: { includeArchived?: boolean } = {},
  ): Promise<AccountWithBalance[]> {
    const where = options.includeArchived ? '' : 'WHERE a.is_archived = 0';
    const rows = await this.db.getAllAsync<AccountWithBalanceRow>(
      `SELECT ${ACCOUNT_COLUMNS}, ${BALANCE_EXPRESSION}, ${USAGE_EXPRESSIONS}
         FROM accounts a ${where}
        ORDER BY a.is_archived ASC, a.name COLLATE NOCASE ASC`,
    );
    return rows.map(mapAccountWithBalance);
  }

  async deleteIfUnused(id: string): Promise<boolean> {
    const result = await this.db.runAsync(
      `DELETE FROM accounts
        WHERE id = ?
          AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.account_id = ?)
          AND NOT EXISTS (
            SELECT 1 FROM transfers tr
             WHERE tr.from_account_id = ? OR tr.to_account_id = ?
          )`,
      [id, id, id, id],
    );
    return result.changes > 0;
  }
}
