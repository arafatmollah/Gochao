import type { WatchItem, WatchFilter } from '@/types/entertainment';

import { escapeLikePattern, type SqlDatabase, type SqlParam } from '../sql';

interface WatchItemRow {
  id: string;
  title: string;
  kind: WatchItem['kind'];
  status: WatchItem['status'];
  url: string | null;
  rating: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: WatchItemRow): WatchItem {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    url: row.url,
    rating: row.rating,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const DEFAULT_WATCH_LIST_LIMIT = 300;

export interface WatchlistRepository {
  insert(item: WatchItem): Promise<void>;
  update(item: WatchItem): Promise<void>;
  findById(id: string): Promise<WatchItem | null>;
  /** Case-insensitive title lookup (spotlight "already saved" check). */
  findByTitle(title: string, kind: WatchItem['kind']): Promise<WatchItem | null>;
  list(filter: WatchFilter): Promise<WatchItem[]>;
  delete(id: string): Promise<boolean>;
}

function buildFilter(filter: WatchFilter): { where: string; params: SqlParam[] } {
  const conditions: string[] = [];
  const params: SqlParam[] = [];

  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  if (filter.kind) {
    conditions.push('kind = ?');
    params.push(filter.kind);
  }
  if (filter.search && filter.search.trim() !== '') {
    conditions.push(`title LIKE ? ESCAPE '\\'`);
    params.push(`%${escapeLikePattern(filter.search.trim())}%`);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

const COLUMNS = 'id, title, kind, status, url, rating, notes, created_at, updated_at';

const ORDER = `
  ORDER BY CASE status
             WHEN 'watching' THEN 0 WHEN 'want_to_watch' THEN 1 ELSE 2 END ASC,
           updated_at DESC
`;

export class SqliteWatchlistRepository implements WatchlistRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(item: WatchItem): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO watchlist_items (id, title, kind, status, url, rating, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.title,
        item.kind,
        item.status,
        item.url,
        item.rating,
        item.notes,
        item.createdAt,
        item.updatedAt,
      ],
    );
  }

  async update(item: WatchItem): Promise<void> {
    await this.db.runAsync(
      `UPDATE watchlist_items
          SET title = ?, kind = ?, status = ?, url = ?, rating = ?, notes = ?, updated_at = ?
        WHERE id = ?`,
      [item.title, item.kind, item.status, item.url, item.rating, item.notes, item.updatedAt, item.id],
    );
  }

  async findById(id: string): Promise<WatchItem | null> {
    const row = await this.db.getFirstAsync<WatchItemRow>(
      `SELECT ${COLUMNS} FROM watchlist_items WHERE id = ?`,
      [id],
    );
    return row ? mapRow(row) : null;
  }

  async findByTitle(title: string, kind: WatchItem['kind']): Promise<WatchItem | null> {
    const row = await this.db.getFirstAsync<WatchItemRow>(
      `SELECT ${COLUMNS} FROM watchlist_items
        WHERE kind = ? AND title = ? COLLATE NOCASE LIMIT 1`,
      [kind, title.trim()],
    );
    return row ? mapRow(row) : null;
  }

  async list(filter: WatchFilter): Promise<WatchItem[]> {
    const { where, params } = buildFilter(filter);
    const limit = filter.limit ?? DEFAULT_WATCH_LIST_LIMIT;
    const offset = filter.offset ?? 0;

    const rows = await this.db.getAllAsync<WatchItemRow>(
      `SELECT ${COLUMNS} FROM watchlist_items ${where} ${ORDER} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map(mapRow);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM watchlist_items WHERE id = ?', [id]);
    return result.changes > 0;
  }
}
