import type {
  FamilyMember,
  FamilyMemberFilter,
  FamilyRelationship,
} from '@/types/family';

import { escapeLikePattern, type SqlDatabase, type SqlParam } from '../sql';

interface FamilyMemberRow {
  id: string;
  name: string;
  relationship: FamilyRelationship;
  contact: string | null;
  notes: string | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: FamilyMemberRow): FamilyMember {
  return {
    id: row.id,
    name: row.name,
    relationship: row.relationship,
    contact: row.contact,
    notes: row.notes,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const DEFAULT_FAMILY_MEMBER_LIMIT = 200;

export interface FamilyMemberRepository {
  insert(member: FamilyMember): Promise<void>;
  update(member: FamilyMember): Promise<void>;
  findById(id: string): Promise<FamilyMember | null>;
  list(filter: FamilyMemberFilter): Promise<FamilyMember[]>;
  count(filter: FamilyMemberFilter): Promise<number>;
  /**
   * Deletes a member only while no family request references them.
   * `false` therefore means "still referenced" — callers distinguish it from
   * "not found" with `findById`.
   */
  deleteIfUnreferenced(id: string): Promise<boolean>;
}

function buildFilter(filter: FamilyMemberFilter): { where: string; params: SqlParam[] } {
  const conditions: string[] = [];
  const params: SqlParam[] = [];

  if (filter.archived !== undefined) {
    conditions.push('is_archived = ?');
    params.push(filter.archived ? 1 : 0);
  }
  if (filter.search && filter.search.trim() !== '') {
    const pattern = `%${escapeLikePattern(filter.search.trim())}%`;
    conditions.push(`name LIKE ? ESCAPE '\\'`);
    params.push(pattern);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

const SELECT_COLUMNS = `
  id, name, relationship, contact, notes, is_archived, created_at, updated_at
`;

export class SqliteFamilyMemberRepository implements FamilyMemberRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(member: FamilyMember): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO family_members (
         id, name, relationship, contact, notes, is_archived,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        member.id,
        member.name,
        member.relationship,
        member.contact,
        member.notes,
        member.isArchived ? 1 : 0,
        member.createdAt,
        member.updatedAt,
      ],
    );
  }

  async update(member: FamilyMember): Promise<void> {
    await this.db.runAsync(
      `UPDATE family_members
          SET name = ?, relationship = ?, contact = ?, notes = ?,
              is_archived = ?, updated_at = ?
        WHERE id = ?`,
      [
        member.name,
        member.relationship,
        member.contact,
        member.notes,
        member.isArchived ? 1 : 0,
        member.updatedAt,
        member.id,
      ],
    );
  }

  async findById(id: string): Promise<FamilyMember | null> {
    const row = await this.db.getFirstAsync<FamilyMemberRow>(
      `SELECT ${SELECT_COLUMNS} FROM family_members WHERE id = ?`,
      [id],
    );
    return row ? mapRow(row) : null;
  }

  async list(filter: FamilyMemberFilter): Promise<FamilyMember[]> {
    const { where, params } = buildFilter(filter);
    const limit = filter.limit ?? DEFAULT_FAMILY_MEMBER_LIMIT;
    const offset = filter.offset ?? 0;

    const rows = await this.db.getAllAsync<FamilyMemberRow>(
      `SELECT ${SELECT_COLUMNS} FROM family_members ${where}
        ORDER BY is_archived ASC, name COLLATE NOCASE ASC, created_at ASC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map(mapRow);
  }

  async count(filter: FamilyMemberFilter): Promise<number> {
    const { where, params } = buildFilter(filter);
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM family_members ${where}`,
      params,
    );
    return row?.total ?? 0;
  }

  async deleteIfUnreferenced(id: string): Promise<boolean> {
    const result = await this.db.runAsync(
      `DELETE FROM family_members
        WHERE id = ?
          AND NOT EXISTS (
            SELECT 1 FROM family_requests fr WHERE fr.member_id = family_members.id
          )`,
      [id],
    );
    return result.changes > 0;
  }
}
