import type { Budget, BudgetWithUsage } from '@/types/finance';

import type { SqlDatabase } from '../sql';

interface BudgetRow {
  id: string;
  category_id: string;
  amount_minor: number;
  created_at: string;
  updated_at: string;
}

type BudgetWithUsageRow = BudgetRow & {
  category_name: string;
  category_is_builtin: number;
  spent_minor: number;
};

function mapBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    categoryId: row.category_id,
    amountMinor: row.amount_minor,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const BUDGET_COLUMNS = 'b.id, b.category_id, b.amount_minor, b.created_at, b.updated_at';

/**
 * Monthly budgets by expense category (master prompt Module D). One row per
 * category (UNIQUE). Usage is always derived from stored transactions for
 * the requested month — never stored, never estimated.
 */
export interface BudgetRepository {
  insert(budget: Budget): Promise<void>;
  update(budget: Budget): Promise<void>;
  findById(id: string): Promise<Budget | null>;
  findByCategoryId(categoryId: string): Promise<Budget | null>;
  listWithUsage(options: { startOn: string; nextStartOn: string }): Promise<BudgetWithUsage[]>;
  delete(id: string): Promise<boolean>;
}

export class SqliteBudgetRepository implements BudgetRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(budget: Budget): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO budgets (id, category_id, amount_minor, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [budget.id, budget.categoryId, budget.amountMinor, budget.createdAt, budget.updatedAt],
    );
  }

  async update(budget: Budget): Promise<void> {
    await this.db.runAsync(
      `UPDATE budgets
          SET category_id = ?, amount_minor = ?, updated_at = ?
        WHERE id = ?`,
      [budget.categoryId, budget.amountMinor, budget.updatedAt, budget.id],
    );
  }

  async findById(id: string): Promise<Budget | null> {
    const row = await this.db.getFirstAsync<BudgetRow>(
      `SELECT ${BUDGET_COLUMNS} FROM budgets b WHERE b.id = ?`,
      [id],
    );
    return row ? mapBudget(row) : null;
  }

  async findByCategoryId(categoryId: string): Promise<Budget | null> {
    const row = await this.db.getFirstAsync<BudgetRow>(
      `SELECT ${BUDGET_COLUMNS} FROM budgets b WHERE b.category_id = ?`,
      [categoryId],
    );
    return row ? mapBudget(row) : null;
  }

  async listWithUsage(options: {
    startOn: string;
    nextStartOn: string;
  }): Promise<BudgetWithUsage[]> {
    const rows = await this.db.getAllAsync<BudgetWithUsageRow>(
      `SELECT ${BUDGET_COLUMNS},
         c.name AS category_name,
         c.is_builtin AS category_is_builtin,
         IFNULL((
           SELECT SUM(t.amount_minor) FROM transactions t
            WHERE t.kind = 'expense'
              AND t.category_id = b.category_id
              AND t.occurred_on >= ? AND t.occurred_on < ?
         ), 0) AS spent_minor
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
      ORDER BY c.sort_order ASC, c.name COLLATE NOCASE ASC`,
      [options.startOn, options.nextStartOn],
    );
    return rows.map((row) => ({
      ...mapBudget(row),
      categoryName: row.category_name,
      categoryIsBuiltin: row.category_is_builtin === 1,
      spentMinor: row.spent_minor,
    }));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.runAsync(`DELETE FROM budgets WHERE id = ?`, [id]);
    return result.changes > 0;
  }
}
