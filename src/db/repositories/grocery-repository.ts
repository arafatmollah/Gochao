import type {
  GroceryItem,
  GroceryItemFilter,
  GroceryItemWithMember,
  GroceryList,
  GroceryListFilter,
  GroceryListSummary,
} from '@/types/grocery';

import { escapeLikePattern, type SqlDatabase, type SqlParam } from '../sql';

interface GroceryListRow {
  id: string;
  name: string;
  notes: string | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

interface GroceryItemRow {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  estimated_price_minor: number | null;
  actual_price_minor: number | null;
  is_purchased: number;
  purchased_at: string | null;
  assigned_member_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface GroceryItemWithMemberRow extends GroceryItemRow {
  assigned_member_name: string | null;
}

function mapListRow(row: GroceryListRow): GroceryList {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItemRow(row: GroceryItemRow): GroceryItem {
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    estimatedPriceMinor: row.estimated_price_minor,
    actualPriceMinor: row.actual_price_minor,
    isPurchased: row.is_purchased === 1,
    purchasedAt: row.purchased_at,
    assignedMemberId: row.assigned_member_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItemWithMember(row: GroceryItemWithMemberRow): GroceryItemWithMember {
  return {
    ...mapItemRow(row),
    assignedMemberName: row.assigned_member_name,
  };
}

export const DEFAULT_GROCERY_LIST_LIMIT = 200;
export const DEFAULT_GROCERY_ITEM_LIMIT = 500;

export interface GroceryRepository {
  insertList(list: GroceryList): Promise<void>;
  updateList(list: GroceryList): Promise<void>;
  findListById(id: string): Promise<GroceryList | null>;
  listSummaries(filter: GroceryListFilter): Promise<GroceryListSummary[]>;
  countLists(filter: GroceryListFilter): Promise<number>;
  deleteList(id: string): Promise<boolean>;

  insertItem(item: GroceryItem): Promise<void>;
  updateItem(item: GroceryItem): Promise<void>;
  findItemById(id: string): Promise<GroceryItemWithMember | null>;
  listItems(listId: string, filter: GroceryItemFilter): Promise<GroceryItemWithMember[]>;
  countRemaining(listId: string): Promise<number>;
  /** Total items of the list, regardless of any display filter. */
  countItems(listId: string): Promise<number>;
  /** Sums over every item of the list, regardless of any display filter. */
  sumTotals(listId: string): Promise<{ estimatedTotalMinor: number; actualTotalMinor: number }>;
  deleteItem(id: string): Promise<boolean>;
  /** True when a family member with this id exists (for assignment guards). */
  memberExists(id: string): Promise<boolean>;
  /** Active (non-archived) family members for the assignee picker. */
  listActiveMembers(): Promise<{ id: string; name: string }[]>;
}

const LIST_COLUMNS = 'id, name, notes, is_archived, created_at, updated_at';

const LIST_COLUMNS_QUALIFIED =
  'l.id, l.name, l.notes, l.is_archived, l.created_at, l.updated_at';

const ITEM_COLUMNS = `
  i.id, i.list_id, i.name, i.quantity, i.unit, i.estimated_price_minor,
  i.actual_price_minor, i.is_purchased, i.purchased_at, i.assigned_member_id,
  i.notes, i.created_at, i.updated_at
`;

const ITEM_FROM = `
  FROM grocery_items i
  LEFT JOIN family_members m ON m.id = i.assigned_member_id
`;

function buildListFilter(filter: GroceryListFilter): { where: string; params: SqlParam[] } {
  const conditions: string[] = [];
  const params: SqlParam[] = [];

  if (filter.archived !== undefined) {
    conditions.push('is_archived = ?');
    params.push(filter.archived ? 1 : 0);
  }
  if (filter.search && filter.search.trim() !== '') {
    conditions.push(`name LIKE ? ESCAPE '\\'`);
    params.push(`%${escapeLikePattern(filter.search.trim())}%`);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

function buildItemFilter(filter: GroceryItemFilter): { where: string; params: SqlParam[] } {
  const conditions: string[] = [];
  const params: SqlParam[] = [];

  if (filter.purchased !== undefined) {
    conditions.push('i.is_purchased = ?');
    params.push(filter.purchased ? 1 : 0);
  }
  if (filter.search && filter.search.trim() !== '') {
    conditions.push(`i.name LIKE ? ESCAPE '\\'`);
    params.push(`%${escapeLikePattern(filter.search.trim())}%`);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

export class SqliteGroceryRepository implements GroceryRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insertList(list: GroceryList): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO grocery_lists (id, name, notes, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [list.id, list.name, list.notes, list.isArchived ? 1 : 0, list.createdAt, list.updatedAt],
    );
  }

  async updateList(list: GroceryList): Promise<void> {
    await this.db.runAsync(
      `UPDATE grocery_lists
          SET name = ?, notes = ?, is_archived = ?, updated_at = ?
        WHERE id = ?`,
      [list.name, list.notes, list.isArchived ? 1 : 0, list.updatedAt, list.id],
    );
  }

  async findListById(id: string): Promise<GroceryList | null> {
    const row = await this.db.getFirstAsync<GroceryListRow>(
      `SELECT ${LIST_COLUMNS} FROM grocery_lists WHERE id = ?`,
      [id],
    );
    return row ? mapListRow(row) : null;
  }

  async listSummaries(filter: GroceryListFilter): Promise<GroceryListSummary[]> {
    const { where, params } = buildListFilter(filter);
    const limit = filter.limit ?? DEFAULT_GROCERY_LIST_LIMIT;
    const offset = filter.offset ?? 0;
    // Filters are built against unqualified list columns; qualify them here
    // because the summary query joins the items table.
    const qualifiedWhere = where
      .replace(/is_archived/g, 'l.is_archived')
      .replace(/name LIKE/g, 'l.name LIKE');

    const rows = await this.db.getAllAsync<GroceryListRow & {
      total_items: number;
      remaining_items: number;
      estimated_total_minor: number;
      actual_total_minor: number;
    }>(
      `SELECT ${LIST_COLUMNS_QUALIFIED},
              COUNT(i.id) AS total_items,
              SUM(CASE WHEN i.is_purchased = 0 THEN 1 ELSE 0 END) AS remaining_items,
              IFNULL(SUM(i.estimated_price_minor), 0) AS estimated_total_minor,
              IFNULL(SUM(i.actual_price_minor), 0) AS actual_total_minor
         FROM grocery_lists l
         LEFT JOIN grocery_items i ON i.list_id = l.id
         ${qualifiedWhere}
        GROUP BY l.id
        ORDER BY l.is_archived ASC, l.updated_at DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return rows.map((row) => ({
      ...mapListRow(row),
      totalItems: row.total_items,
      remainingItems: row.remaining_items ?? 0,
      estimatedTotalMinor: row.estimated_total_minor,
      actualTotalMinor: row.actual_total_minor,
    }));
  }

  async countLists(filter: GroceryListFilter): Promise<number> {
    const { where, params } = buildListFilter(filter);
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM grocery_lists ${where}`,
      params,
    );
    return row?.total ?? 0;
  }

  async deleteList(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM grocery_lists WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async insertItem(item: GroceryItem): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO grocery_items (
         id, list_id, name, quantity, unit, estimated_price_minor,
         actual_price_minor, is_purchased, purchased_at, assigned_member_id,
         notes, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.listId,
        item.name,
        item.quantity,
        item.unit,
        item.estimatedPriceMinor,
        item.actualPriceMinor,
        item.isPurchased ? 1 : 0,
        item.purchasedAt,
        item.assignedMemberId,
        item.notes,
        item.createdAt,
        item.updatedAt,
      ],
    );
  }

  async updateItem(item: GroceryItem): Promise<void> {
    await this.db.runAsync(
      `UPDATE grocery_items
          SET list_id = ?, name = ?, quantity = ?, unit = ?,
              estimated_price_minor = ?, actual_price_minor = ?,
              is_purchased = ?, purchased_at = ?, assigned_member_id = ?,
              notes = ?, updated_at = ?
        WHERE id = ?`,
      [
        item.listId,
        item.name,
        item.quantity,
        item.unit,
        item.estimatedPriceMinor,
        item.actualPriceMinor,
        item.isPurchased ? 1 : 0,
        item.purchasedAt,
        item.assignedMemberId,
        item.notes,
        item.updatedAt,
        item.id,
      ],
    );
  }

  async findItemById(id: string): Promise<GroceryItemWithMember | null> {
    const row = await this.db.getFirstAsync<GroceryItemWithMemberRow>(
      `SELECT ${ITEM_COLUMNS}, m.name AS assigned_member_name ${ITEM_FROM} WHERE i.id = ?`,
      [id],
    );
    if (!row) {
      return null;
    }
    return mapItemWithMember(row);
  }

  async listItems(listId: string, filter: GroceryItemFilter = {}): Promise<GroceryItemWithMember[]> {
    const { where, params } = buildItemFilter(filter);
    const listCondition = 'i.list_id = ?';
    const combined = where ? `${where} AND ${listCondition}` : `WHERE ${listCondition}`;
    const limit = filter.limit ?? DEFAULT_GROCERY_ITEM_LIMIT;
    const offset = filter.offset ?? 0;

    const rows = await this.db.getAllAsync<GroceryItemWithMemberRow>(
      `SELECT ${ITEM_COLUMNS}, m.name AS assigned_member_name ${ITEM_FROM}
       ${combined}
       ORDER BY i.is_purchased ASC, i.created_at ASC
       LIMIT ? OFFSET ?`,
      [...params, listId, limit, offset],
    );
    return rows.map(mapItemWithMember);
  }

  async countRemaining(listId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM grocery_items WHERE list_id = ? AND is_purchased = 0`,
      [listId],
    );
    return row?.total ?? 0;
  }

  async countItems(listId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM grocery_items WHERE list_id = ?`,
      [listId],
    );
    return row?.total ?? 0;
  }

  async sumTotals(listId: string): Promise<{ estimatedTotalMinor: number; actualTotalMinor: number }> {
    const row = await this.db.getFirstAsync<{
      estimated_total_minor: number;
      actual_total_minor: number;
    }>(
      `SELECT IFNULL(SUM(estimated_price_minor), 0) AS estimated_total_minor,
              IFNULL(SUM(actual_price_minor), 0) AS actual_total_minor
         FROM grocery_items WHERE list_id = ?`,
      [listId],
    );
    return {
      estimatedTotalMinor: row?.estimated_total_minor ?? 0,
      actualTotalMinor: row?.actual_total_minor ?? 0,
    };
  }

  async deleteItem(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM grocery_items WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async memberExists(id: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM family_members WHERE id = ?`,
      [id],
    );
    return (row?.total ?? 0) > 0;
  }

  async listActiveMembers(): Promise<{ id: string; name: string }[]> {
    return this.db.getAllAsync<{ id: string; name: string }>(
      `SELECT id, name FROM family_members WHERE is_archived = 0 ORDER BY name COLLATE NOCASE ASC`,
    );
  }
}
