import type { Category, CategoryKind, CategoryWithUsage } from '@/types/finance';

import type { SqlDatabase, SqlParam } from '../sql';

interface CategoryRow {
  id: string;
  kind: CategoryKind;
  name: string;
  is_builtin: number;
  is_archived: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

type CategoryWithUsageRow = CategoryRow & {
  transaction_count: number;
  budget_id: string | null;
};

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    isBuiltin: row.is_builtin === 1,
    isArchived: row.is_archived === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCategoryWithUsage(row: CategoryWithUsageRow): CategoryWithUsage {
  return {
    ...mapCategory(row),
    transactionCount: row.transaction_count,
    budgetId: row.budget_id,
  };
}

const CATEGORY_COLUMNS =
  'c.id, c.kind, c.name, c.is_builtin, c.is_archived, c.sort_order, c.created_at, c.updated_at';

export interface CategoryListOptions {
  kind?: CategoryKind;
  includeArchived?: boolean;
}

export interface CategoryRepository {
  insert(category: Category): Promise<void>;
  update(category: Category): Promise<void>;
  findById(id: string): Promise<Category | null>;
  /** Case-insensitive duplicate check within the same kind. */
  findByKindAndName(kind: CategoryKind, name: string): Promise<Category | null>;
  /** Built-in order first (sort_order), then customs alphabetically. */
  list(options?: CategoryListOptions): Promise<Category[]>;
  listWithUsage(options?: CategoryListOptions): Promise<CategoryWithUsage[]>;
  /**
   * Deletes a custom category only when no transaction or budget uses it.
   * Returns false for built-ins, unknown ids, and in-use categories.
   */
  deleteIfUnused(id: string): Promise<boolean>;
}

export class SqliteCategoryRepository implements CategoryRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(category: Category): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO categories (
         id, kind, name, is_builtin, is_archived, sort_order, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category.id,
        category.kind,
        category.name,
        category.isBuiltin ? 1 : 0,
        category.isArchived ? 1 : 0,
        category.sortOrder,
        category.createdAt,
        category.updatedAt,
      ],
    );
  }

  async update(category: Category): Promise<void> {
    await this.db.runAsync(
      `UPDATE categories
          SET kind = ?, name = ?, is_builtin = ?, is_archived = ?, sort_order = ?,
              updated_at = ?
        WHERE id = ?`,
      [
        category.kind,
        category.name,
        category.isBuiltin ? 1 : 0,
        category.isArchived ? 1 : 0,
        category.sortOrder,
        category.updatedAt,
        category.id,
      ],
    );
  }

  async findById(id: string): Promise<Category | null> {
    const row = await this.db.getFirstAsync<CategoryRow>(
      `SELECT ${CATEGORY_COLUMNS} FROM categories c WHERE c.id = ?`,
      [id],
    );
    return row ? mapCategory(row) : null;
  }

  async findByKindAndName(kind: CategoryKind, name: string): Promise<Category | null> {
    const row = await this.db.getFirstAsync<CategoryRow>(
      `SELECT ${CATEGORY_COLUMNS}
         FROM categories c
        WHERE c.kind = ? AND c.name = ? COLLATE NOCASE`,
      [kind, name],
    );
    return row ? mapCategory(row) : null;
  }

  async list(options: CategoryListOptions = {}): Promise<Category[]> {
    const { where, params } = buildListWhere(options);
    const rows = await this.db.getAllAsync<CategoryRow>(
      `SELECT ${CATEGORY_COLUMNS}
         FROM categories c ${where}
        ORDER BY c.sort_order ASC, c.name COLLATE NOCASE ASC`,
      params,
    );
    return rows.map(mapCategory);
  }

  async listWithUsage(options: CategoryListOptions = {}): Promise<CategoryWithUsage[]> {
    const { where, params } = buildListWhere(options);
    const rows = await this.db.getAllAsync<CategoryWithUsageRow>(
      `SELECT ${CATEGORY_COLUMNS},
         (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id)
           AS transaction_count,
         (SELECT b.id FROM budgets b WHERE b.category_id = c.id LIMIT 1)
           AS budget_id
       FROM categories c ${where}
      ORDER BY c.sort_order ASC, c.name COLLATE NOCASE ASC`,
      params,
    );
    return rows.map(mapCategoryWithUsage);
  }

  async deleteIfUnused(id: string): Promise<boolean> {
    const result = await this.db.runAsync(
      `DELETE FROM categories
        WHERE id = ?
          AND is_builtin = 0
          AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.category_id = ?)
          AND NOT EXISTS (SELECT 1 FROM budgets b WHERE b.category_id = ?)`,
      [id, id, id],
    );
    return result.changes > 0;
  }
}

function buildListWhere(options: CategoryListOptions): {
  where: string;
  params: SqlParam[];
} {
  const conditions: string[] = [];
  const params: SqlParam[] = [];
  if (options.kind) {
    conditions.push('c.kind = ?');
    params.push(options.kind);
  }
  if (!options.includeArchived) {
    conditions.push('c.is_archived = 0');
  }
  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}
