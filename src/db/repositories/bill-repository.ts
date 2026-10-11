import type {
  Bill,
  BillCategory,
  BillDueItem,
  BillOccurrence,
  BillOccurrenceStatus,
  BillRecurrence,
  BillSummary,
  OccurrenceFilter,
} from '@/types/bill';
import type { Transaction } from '@/types/finance';

import type { SqlDatabase, SqlParam } from '../sql';

interface BillRow {
  id: string;
  name: string;
  category: BillCategory;
  expected_amount_minor: number;
  recurrence: BillRecurrence;
  first_due_on: string;
  installment_count: number | null;
  reminder_days_before: number | null;
  notes: string | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

interface OccurrenceRow {
  id: string;
  bill_id: string;
  due_on: string;
  expected_amount_minor: number;
  status: BillOccurrenceStatus;
  paid_amount_minor: number | null;
  paid_on: string | null;
  created_at: string;
  updated_at: string;
}

type OccurrenceWithBillRow = OccurrenceRow & {
  bill_name: string;
  bill_category: BillCategory;
};

type BillSummaryRow = BillRow & {
  next_due_on: string | null;
  paid_count: number;
  occurrence_count: number;
};

function mapBill(row: BillRow): Bill {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    expectedAmountMinor: row.expected_amount_minor,
    recurrence: row.recurrence,
    firstDueOn: row.first_due_on,
    installmentCount: row.installment_count,
    reminderDaysBefore: row.reminder_days_before,
    notes: row.notes,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOccurrence(row: OccurrenceRow): BillOccurrence {
  return {
    id: row.id,
    billId: row.bill_id,
    dueOn: row.due_on,
    expectedAmountMinor: row.expected_amount_minor,
    status: row.status,
    paidAmountMinor: row.paid_amount_minor,
    paidOn: row.paid_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDueItem(row: OccurrenceWithBillRow): BillDueItem {
  return {
    ...mapOccurrence(row),
    billName: row.bill_name,
    billCategory: row.bill_category,
  };
}

function mapSummary(row: BillSummaryRow): BillSummary {
  return {
    ...mapBill(row),
    nextDueOn: row.next_due_on,
    paidCount: row.paid_count,
    occurrenceCount: row.occurrence_count,
  };
}

export const DEFAULT_BILL_LIST_LIMIT = 200;

const BILL_COLUMNS = `
  id, name, category, expected_amount_minor, recurrence, first_due_on,
  installment_count, reminder_days_before, notes, is_archived,
  created_at, updated_at
`;

/** Same columns, single line for embedding in multi-line SELECTs. */
const BILL_COLUMNS_INLINE =
  'id, name, category, expected_amount_minor, recurrence, first_due_on, ' +
  'installment_count, reminder_days_before, notes, is_archived, created_at, updated_at';

const OCCURRENCE_COLUMNS = `
  id, bill_id, due_on, expected_amount_minor, status,
  paid_amount_minor, paid_on, created_at, updated_at
`;

const DUE_ITEM_COLUMNS = `
  o.id, o.bill_id, o.due_on, o.expected_amount_minor, o.status,
  o.paid_amount_minor, o.paid_on, o.created_at, o.updated_at,
  b.name AS bill_name, b.category AS bill_category
`;

export interface GenerationCandidate {
  bill: Bill;
  lastDueOn: string | null;
  occurrenceCount: number;
}

export interface NewOccurrence {
  id: string;
  billId: string;
  dueOn: string;
  expectedAmountMinor: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillRepository {
  insert(bill: Bill): Promise<void>;
  update(bill: Bill): Promise<void>;
  findById(id: string): Promise<Bill | null>;
  /** Bills with derived schedule facts; archived rows included only on request. */
  listSummaries(options?: { includeArchived?: boolean }): Promise<BillSummary[]>;
  /** Occurrences (joined with bill display fields) matching the filter. */
  listOccurrences(filter: OccurrenceFilter): Promise<BillDueItem[]>;
  listByBill(billId: string): Promise<BillOccurrence[]>;
  findOccurrenceById(id: string): Promise<BillDueItem | null>;
  /** Idempotent: an existing (bill, due date) row is left untouched. */
  insertOccurrence(occurrence: NewOccurrence): Promise<void>;
  listGenerationCandidates(): Promise<GenerationCandidate[]>;
  /** Marks a pending occurrence paid; false when it was not pending. */
  markPaidIfPending(
    id: string,
    payment: { paidAmountMinor: number; paidOn: string; updatedAt: string },
  ): Promise<boolean>;
  /** Reverts a paid occurrence; false when it was not paid. */
  markUnpaidIfPaid(id: string, updatedAt: string): Promise<boolean>;
  /** Syncs the expected amount of pending (unpaid) occurrences only. */
  syncPendingExpectedAmount(billId: string, amountMinor: number, updatedAt: string): Promise<void>;
  /**
   * Deletes a bill and its occurrences atomically, but only when no paid
   * occurrence exists — payment history is never destroyed by this call.
   * Returns false when the bill does not exist or has payments.
   */
  deleteIfNoPayments(id: string): Promise<boolean>;
  /** Sum of pending expected amounts of active bills due in [startOn, endOn). */
  sumPendingDueBetween(startOn: string, endOn: string): Promise<number>;
  /**
   * Files the expense transaction for a paid occurrence. `billOccurrenceId`
   * must be set; the UNIQUE constraint plus `ON CONFLICT DO NOTHING` makes
   * the write idempotent — one expense per occurrence, ever. Returns whether
   * a row was actually inserted.
   */
  insertLinkedExpense(expense: Transaction): Promise<boolean>;
  /** Removes the expense filed for an occurrence (payment undo path). */
  deleteLinkedExpense(occurrenceId: string): Promise<void>;
  /**
   * Runs `task` with a repository bound to an exclusive transaction. Used
   * for multi-step writes (create/update). Do not nest.
   */
  runInTransaction<T>(task: (repo: BillRepository) => Promise<T>): Promise<T>;
}

export class SqliteBillRepository implements BillRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(bill: Bill): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO bills (
         id, name, category, expected_amount_minor, recurrence, first_due_on,
         installment_count, reminder_days_before, notes, is_archived,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bill.id,
        bill.name,
        bill.category,
        bill.expectedAmountMinor,
        bill.recurrence,
        bill.firstDueOn,
        bill.installmentCount,
        bill.reminderDaysBefore,
        bill.notes,
        bill.isArchived ? 1 : 0,
        bill.createdAt,
        bill.updatedAt,
      ],
    );
  }

  async update(bill: Bill): Promise<void> {
    await this.db.runAsync(
      `UPDATE bills
          SET name = ?, category = ?, expected_amount_minor = ?, recurrence = ?,
              first_due_on = ?, installment_count = ?, reminder_days_before = ?,
              notes = ?, is_archived = ?, updated_at = ?
        WHERE id = ?`,
      [
        bill.name,
        bill.category,
        bill.expectedAmountMinor,
        bill.recurrence,
        bill.firstDueOn,
        bill.installmentCount,
        bill.reminderDaysBefore,
        bill.notes,
        bill.isArchived ? 1 : 0,
        bill.updatedAt,
        bill.id,
      ],
    );
  }

  async findById(id: string): Promise<Bill | null> {
    const row = await this.db.getFirstAsync<BillRow>(
      `SELECT ${BILL_COLUMNS} FROM bills WHERE id = ?`,
      [id],
    );
    return row ? mapBill(row) : null;
  }

  async listSummaries(options: { includeArchived?: boolean } = {}): Promise<BillSummary[]> {
    const where = options.includeArchived ? '' : 'WHERE b.is_archived = 0';
    const rows = await this.db.getAllAsync<BillSummaryRow>(
      `SELECT ${BILL_COLUMNS_INLINE},
         (SELECT MIN(o.due_on) FROM bill_occurrences o
           WHERE o.bill_id = b.id AND o.status = 'pending') AS next_due_on,
         (SELECT COUNT(*) FROM bill_occurrences o
           WHERE o.bill_id = b.id AND o.status = 'paid') AS paid_count,
         (SELECT COUNT(*) FROM bill_occurrences o
           WHERE o.bill_id = b.id) AS occurrence_count
       FROM bills b ${where}
       ORDER BY b.is_archived ASC,
                (next_due_on IS NULL) ASC,
                next_due_on ASC,
                b.name COLLATE NOCASE ASC`,
    );
    return rows.map(mapSummary);
  }

  async listOccurrences(filter: OccurrenceFilter): Promise<BillDueItem[]> {
    const conditions: string[] = ['o.status = ?'];
    const params: SqlParam[] = [filter.status ?? 'pending'];
    if (!filter.includeArchivedBills) {
      conditions.push('b.is_archived = 0');
    }
    if (filter.dueOnOrBefore) {
      conditions.push('o.due_on <= ?');
      params.push(filter.dueOnOrBefore);
    }

    const order =
      (filter.status ?? 'pending') === 'paid'
        ? `ORDER BY o.paid_on DESC, o.updated_at DESC`
        : `ORDER BY o.due_on ASC, b.name COLLATE NOCASE ASC`;

    const limit = filter.limit ?? DEFAULT_BILL_LIST_LIMIT;
    const offset = filter.offset ?? 0;

    const rows = await this.db.getAllAsync<OccurrenceWithBillRow>(
      `SELECT ${DUE_ITEM_COLUMNS}
         FROM bill_occurrences o
         JOIN bills b ON b.id = o.bill_id
        WHERE ${conditions.join(' AND ')}
        ${order}
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map(mapDueItem);
  }

  async listByBill(billId: string): Promise<BillOccurrence[]> {
    const rows = await this.db.getAllAsync<OccurrenceRow>(
      `SELECT ${OCCURRENCE_COLUMNS} FROM bill_occurrences
        WHERE bill_id = ?
        ORDER BY due_on DESC, updated_at DESC`,
      [billId],
    );
    return rows.map(mapOccurrence);
  }

  async findOccurrenceById(id: string): Promise<BillDueItem | null> {
    const row = await this.db.getFirstAsync<OccurrenceWithBillRow>(
      `SELECT ${DUE_ITEM_COLUMNS}
         FROM bill_occurrences o
         JOIN bills b ON b.id = o.bill_id
        WHERE o.id = ?`,
      [id],
    );
    return row ? mapDueItem(row) : null;
  }

  async insertOccurrence(occurrence: NewOccurrence): Promise<void> {
    // ON CONFLICT makes schedule materialization idempotent: two concurrent
    // ensures, or a retry after a partial run, cannot duplicate a due date.
    await this.db.runAsync(
      `INSERT INTO bill_occurrences (
         id, bill_id, due_on, expected_amount_minor, status,
         paid_amount_minor, paid_on, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)
       ON CONFLICT (bill_id, due_on) DO NOTHING`,
      [
        occurrence.id,
        occurrence.billId,
        occurrence.dueOn,
        occurrence.expectedAmountMinor,
        occurrence.createdAt,
        occurrence.updatedAt,
      ],
    );
  }

  async listGenerationCandidates(): Promise<GenerationCandidate[]> {
    const rows = await this.db.getAllAsync<
      BillRow & { last_due_on: string | null; occurrence_count: number }
    >(
      `SELECT ${BILL_COLUMNS_INLINE},
         (SELECT MAX(o.due_on) FROM bill_occurrences o
           WHERE o.bill_id = b.id) AS last_due_on,
         (SELECT COUNT(*) FROM bill_occurrences o
           WHERE o.bill_id = b.id) AS occurrence_count
       FROM bills b
       WHERE b.is_archived = 0`,
    );
    return rows.map((row) => ({
      bill: mapBill(row),
      lastDueOn: row.last_due_on,
      occurrenceCount: row.occurrence_count,
    }));
  }

  async markPaidIfPending(
    id: string,
    payment: { paidAmountMinor: number; paidOn: string; updatedAt: string },
  ): Promise<boolean> {
    const result = await this.db.runAsync(
      `UPDATE bill_occurrences
          SET status = 'paid', paid_amount_minor = ?, paid_on = ?, updated_at = ?
        WHERE id = ? AND status = 'pending'`,
      [payment.paidAmountMinor, payment.paidOn, payment.updatedAt, id],
    );
    return result.changes > 0;
  }

  async markUnpaidIfPaid(id: string, updatedAt: string): Promise<boolean> {
    const result = await this.db.runAsync(
      `UPDATE bill_occurrences
          SET status = 'pending', paid_amount_minor = NULL, paid_on = NULL, updated_at = ?
        WHERE id = ? AND status = 'paid'`,
      [updatedAt, id],
    );
    return result.changes > 0;
  }

  async syncPendingExpectedAmount(
    billId: string,
    amountMinor: number,
    updatedAt: string,
  ): Promise<void> {
    await this.db.runAsync(
      `UPDATE bill_occurrences
          SET expected_amount_minor = ?, updated_at = ?
        WHERE bill_id = ? AND status = 'pending'`,
      [amountMinor, updatedAt, billId],
    );
  }

  async deleteIfNoPayments(id: string): Promise<boolean> {
    const result = await this.db.runAsync(
      `DELETE FROM bills
        WHERE id = ? AND NOT EXISTS (
          SELECT 1 FROM bill_occurrences
           WHERE bill_id = ? AND status = 'paid'
        )`,
      [id, id],
    );
    return result.changes > 0;
  }

  async sumPendingDueBetween(startOn: string, endOn: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT IFNULL(SUM(o.expected_amount_minor), 0) AS total
         FROM bill_occurrences o
         JOIN bills b ON b.id = o.bill_id
        WHERE b.is_archived = 0
          AND o.status = 'pending'
          AND o.due_on >= ? AND o.due_on < ?`,
      [startOn, endOn],
    );
    return row?.total ?? 0;
  }

  async insertLinkedExpense(expense: Transaction): Promise<boolean> {
    if (expense.billOccurrenceId === null) {
      throw new Error('insertLinkedExpense requires billOccurrenceId');
    }
    const result = await this.db.runAsync(
      `INSERT INTO transactions (
         id, kind, amount_minor, account_id, category_id, occurred_on, description,
         recipient, notes, bill_occurrence_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (bill_occurrence_id) DO NOTHING`,
      [
        expense.id,
        expense.kind,
        expense.amountMinor,
        expense.accountId,
        expense.categoryId,
        expense.occurredOn,
        expense.description,
        expense.recipient,
        expense.notes,
        expense.billOccurrenceId,
        expense.createdAt,
        expense.updatedAt,
      ],
    );
    return result.changes > 0;
  }

  async deleteLinkedExpense(occurrenceId: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM transactions WHERE bill_occurrence_id = ?`, [occurrenceId]);
  }

  async runInTransaction<T>(task: (repo: BillRepository) => Promise<T>): Promise<T> {
    let result!: T;
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      result = await task(new SqliteBillRepository(txn));
    });
    return result;
  }
}
