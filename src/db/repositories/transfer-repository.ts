import type { Transfer } from '@/types/finance';

import type { SqlDatabase } from '../sql';

interface TransferRow {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount_minor: number;
  occurred_on: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapTransfer(row: TransferRow): Transfer {
  return {
    id: row.id,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    amountMinor: row.amount_minor,
    occurredOn: row.occurred_on,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TRANSFER_COLUMNS = `
  id, from_account_id, to_account_id, amount_minor, occurred_on, notes,
  created_at, updated_at
`;

/**
 * Transfers between the user's own accounts. A transfer is ONE row, so both
 * sides of the move are always written together — an atomic operation by
 * construction — and transfers are structurally excluded from income and
 * expense sums (engineering rule 11).
 */
export interface TransferRepository {
  insert(transfer: Transfer): Promise<void>;
  update(transfer: Transfer): Promise<void>;
  findById(id: string): Promise<Transfer | null>;
  delete(id: string): Promise<boolean>;
}

export class SqliteTransferRepository implements TransferRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(transfer: Transfer): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO transfers (
         id, from_account_id, to_account_id, amount_minor, occurred_on, notes,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transfer.id,
        transfer.fromAccountId,
        transfer.toAccountId,
        transfer.amountMinor,
        transfer.occurredOn,
        transfer.notes,
        transfer.createdAt,
        transfer.updatedAt,
      ],
    );
  }

  async update(transfer: Transfer): Promise<void> {
    await this.db.runAsync(
      `UPDATE transfers
          SET from_account_id = ?, to_account_id = ?, amount_minor = ?,
              occurred_on = ?, notes = ?, updated_at = ?
        WHERE id = ?`,
      [
        transfer.fromAccountId,
        transfer.toAccountId,
        transfer.amountMinor,
        transfer.occurredOn,
        transfer.notes,
        transfer.updatedAt,
        transfer.id,
      ],
    );
  }

  async findById(id: string): Promise<Transfer | null> {
    const row = await this.db.getFirstAsync<TransferRow>(
      `SELECT ${TRANSFER_COLUMNS} FROM transfers WHERE id = ?`,
      [id],
    );
    return row ? mapTransfer(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.runAsync(`DELETE FROM transfers WHERE id = ?`, [id]);
    return result.changes > 0;
  }
}
