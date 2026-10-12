import type {
  FamilyRequest,
  FamilyRequestFilter,
  FamilyRequestListItem,
  FamilyRequestStatus,
} from '@/types/family';

import { escapeLikePattern, type SqlDatabase, type SqlParam } from '../sql';

interface FamilyRequestRow {
  id: string;
  title: string;
  details: string | null;
  member_id: string | null;
  category: string;
  priority: string;
  deadline: string | null;
  estimated_cost_minor: number | null;
  status: FamilyRequestStatus;
  created_at: string;
  updated_at: string;
}

interface FamilyRequestListRow extends FamilyRequestRow {
  member_name: string | null;
  task_id: string | null;
}

function mapRow(row: FamilyRequestRow): FamilyRequest {
  return {
    id: row.id,
    title: row.title,
    details: row.details,
    memberId: row.member_id,
    category: row.category as FamilyRequest['category'],
    priority: row.priority as FamilyRequest['priority'],
    deadline: row.deadline,
    estimatedCostMinor: row.estimated_cost_minor,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapListRow(row: FamilyRequestListRow): FamilyRequestListItem {
  return {
    ...mapRow(row),
    memberName: row.member_name,
    taskId: row.task_id,
  };
}

export const DEFAULT_FAMILY_REQUEST_LIMIT = 200;

export interface FamilyRequestRepository {
  insert(request: FamilyRequest): Promise<void>;
  update(request: FamilyRequest): Promise<void>;
  findById(id: string): Promise<FamilyRequest | null>;
  list(filter: FamilyRequestFilter): Promise<FamilyRequestListItem[]>;
  count(filter: FamilyRequestFilter): Promise<number>;
  /** Requests still awaiting action (`open` or `in_progress`). */
  countOutstanding(): Promise<number>;
  /** Outstanding requests, nearest deadline first — dashboard preview. */
  listOutstanding(limit: number): Promise<FamilyRequestListItem[]>;
  /** Id of the task generated from this request, if one exists. */
  findTaskLink(requestId: string): Promise<string | null>;
  delete(id: string): Promise<boolean>;
}

function buildFilter(filter: FamilyRequestFilter): { where: string; params: SqlParam[] } {
  const conditions: string[] = [];
  const params: SqlParam[] = [];

  if (filter.status) {
    conditions.push('fr.status = ?');
    params.push(filter.status);
  }
  if (filter.outstandingOnly) {
    conditions.push(`fr.status IN ('open', 'in_progress')`);
  }
  if (filter.memberId) {
    conditions.push('fr.member_id = ?');
    params.push(filter.memberId);
  }
  if (filter.search && filter.search.trim() !== '') {
    const pattern = `%${escapeLikePattern(filter.search.trim())}%`;
    conditions.push(
      `(fr.title LIKE ? ESCAPE '\\' OR IFNULL(fr.details, '') LIKE ? ESCAPE '\\')`,
    );
    params.push(pattern, pattern);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

const LIST_SELECT = `
  SELECT fr.id, fr.title, fr.details, fr.member_id, fr.category, fr.priority,
         fr.deadline, fr.estimated_cost_minor, fr.status, fr.created_at,
         fr.updated_at, m.name AS member_name, t.id AS task_id
    FROM family_requests fr
    LEFT JOIN family_members m ON m.id = fr.member_id
    LEFT JOIN tasks t ON t.family_request_id = fr.id
`;

/**
 * Outstanding work first (open, then in progress) with the nearest deadline
 * on top; settled requests (done, cancelled) sink below, oldest first.
 * Within the same urgency group the oldest request comes first, so newly
 * added requests append below instead of jumping to the top.
 */
const ORDER_DEFAULT = `
  ORDER BY CASE fr.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1
                           WHEN 'done' THEN 2 ELSE 3 END ASC,
            CASE WHEN fr.status IN ('open', 'in_progress')
                 THEN (fr.deadline IS NULL) END ASC,
            CASE WHEN fr.status IN ('open', 'in_progress')
                 THEN fr.deadline END ASC,
            CASE WHEN fr.status IN ('open', 'in_progress') THEN
                 (CASE fr.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END)
            END ASC,
            fr.created_at ASC
`;

export class SqliteFamilyRequestRepository implements FamilyRequestRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(request: FamilyRequest): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO family_requests (
         id, title, details, member_id, category, priority, deadline,
         estimated_cost_minor, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.id,
        request.title,
        request.details,
        request.memberId,
        request.category,
        request.priority,
        request.deadline,
        request.estimatedCostMinor,
        request.status,
        request.createdAt,
        request.updatedAt,
      ],
    );
  }

  async update(request: FamilyRequest): Promise<void> {
    await this.db.runAsync(
      `UPDATE family_requests
          SET title = ?, details = ?, member_id = ?, category = ?, priority = ?,
              deadline = ?, estimated_cost_minor = ?, status = ?, updated_at = ?
        WHERE id = ?`,
      [
        request.title,
        request.details,
        request.memberId,
        request.category,
        request.priority,
        request.deadline,
        request.estimatedCostMinor,
        request.status,
        request.updatedAt,
        request.id,
      ],
    );
  }

  async findById(id: string): Promise<FamilyRequest | null> {
    const row = await this.db.getFirstAsync<FamilyRequestRow>(
      `SELECT id, title, details, member_id, category, priority, deadline,
              estimated_cost_minor, status, created_at, updated_at
         FROM family_requests WHERE id = ?`,
      [id],
    );
    return row ? mapRow(row) : null;
  }

  async list(filter: FamilyRequestFilter): Promise<FamilyRequestListItem[]> {
    const { where, params } = buildFilter(filter);
    const limit = filter.limit ?? DEFAULT_FAMILY_REQUEST_LIMIT;
    const offset = filter.offset ?? 0;

    const rows = await this.db.getAllAsync<FamilyRequestListRow>(
      `${LIST_SELECT} ${where} ${ORDER_DEFAULT} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map(mapListRow);
  }

  async count(filter: FamilyRequestFilter): Promise<number> {
    const { where, params } = buildFilter(filter);
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM family_requests fr ${where}`,
      params,
    );
    return row?.total ?? 0;
  }

  async countOutstanding(): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM family_requests
        WHERE status IN ('open', 'in_progress')`,
    );
    return row?.total ?? 0;
  }

  async listOutstanding(limit: number): Promise<FamilyRequestListItem[]> {
    const rows = await this.db.getAllAsync<FamilyRequestListRow>(
      `${LIST_SELECT}
        WHERE fr.status IN ('open', 'in_progress')
        ORDER BY (fr.deadline IS NULL) ASC,
                 fr.deadline ASC,
                 CASE fr.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
                 fr.updated_at DESC
        LIMIT ?`,
      [limit],
    );
    return rows.map(mapListRow);
  }

  async findTaskLink(requestId: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM tasks WHERE family_request_id = ?',
      [requestId],
    );
    return row?.id ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM family_requests WHERE id = ?', [id]);
    return result.changes > 0;
  }
}
