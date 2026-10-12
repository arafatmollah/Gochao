import type {
  Note,
  NoteCategory,
  NoteCategoryWithUsage,
  NoteListItem,
  NoteListOptions,
  NoteTag,
} from '@/types/note';

import type { SqlDatabase } from '../sql';

interface NoteRow {
  id: string;
  title: string;
  content: string;
  category_id: string | null;
  is_pinned: number;
  created_at: string;
  updated_at: string;
  category_name: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
  created_at: string;
}

interface CategoryWithUsageRow extends CategoryRow {
  note_count: number;
}

interface TagRow {
  id: string;
  name: string;
  created_at: string;
}

interface TagLinkRow {
  note_id: string;
  tag_id: string;
  tag_name: string;
  tag_created_at: string;
}

function mapTag(row: TagRow): NoteTag {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

function mapNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    categoryId: row.category_id,
    isPinned: row.is_pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCategory(row: CategoryRow): NoteCategory {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

const NOTE_COLUMNS =
  'n.id, n.title, n.content, n.category_id, n.is_pinned, n.created_at, ' +
  'n.updated_at, c.name AS category_name';

const NOTE_FROM = 'FROM notes n LEFT JOIN note_categories c ON c.id = n.category_id';

/**
 * Builds a bound LIKE parameter for substring search. Wildcards and the
 * escape character in the user's term are escaped here, in the parameter
 * value — the SQL text itself only ever carries `?` placeholders (rule 8).
 */
function likePattern(term: string): string {
  const escaped = term.replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}

export interface NoteRepository {
  insert(note: Note): Promise<void>;
  update(note: Note): Promise<void>;
  /** Inserts the note and its tag links in one exclusive transaction. */
  insertWithTags(note: Note, tagIds: readonly string[]): Promise<void>;
  /** Updates the note and replaces its tag links in one exclusive transaction. */
  updateWithTags(note: Note, tagIds: readonly string[]): Promise<void>;
  findById(id: string): Promise<NoteListItem | null>;
  /** Pinned first, then most recently modified; optional search + category filter. */
  list(options?: NoteListOptions): Promise<NoteListItem[]>;
  count(): Promise<number>;
  /** Toggling pin is not a content edit, so `updated_at` stays untouched. */
  setPinned(id: string, isPinned: boolean): Promise<boolean>;
  delete(id: string): Promise<boolean>;

  listCategories(): Promise<NoteCategoryWithUsage[]>;
  findCategoryById(id: string): Promise<NoteCategory | null>;
  findCategoryByName(name: string): Promise<NoteCategory | null>;
  insertCategory(category: NoteCategory): Promise<void>;
  /** Detaches the category from its notes (`SET NULL`); notes are kept. */
  deleteCategory(id: string): Promise<boolean>;

  listTags(): Promise<NoteTag[]>;
  findTagByName(name: string): Promise<NoteTag | null>;
  insertTag(tag: NoteTag): Promise<void>;
  deleteTagIfUnused(id: string): Promise<boolean>;
  tagsForNote(noteId: string): Promise<NoteTag[]>;
  /** Replaces the note's tag set atomically. */
  setNoteTags(noteId: string, tagIds: readonly string[]): Promise<void>;
}

export class SqliteNoteRepository implements NoteRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(note: Note): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO notes (
         id, title, content, category_id, is_pinned, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        note.id,
        note.title,
        note.content,
        note.categoryId,
        note.isPinned ? 1 : 0,
        note.createdAt,
        note.updatedAt,
      ],
    );
  }

  async update(note: Note): Promise<void> {
    await this.db.runAsync(
      `UPDATE notes
          SET title = ?, content = ?, category_id = ?, is_pinned = ?, updated_at = ?
        WHERE id = ?`,
      [
        note.title,
        note.content,
        note.categoryId,
        note.isPinned ? 1 : 0,
        note.updatedAt,
        note.id,
      ],
    );
  }

  async insertWithTags(note: Note, tagIds: readonly string[]): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT INTO notes (
           id, title, content, category_id, is_pinned, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          note.id,
          note.title,
          note.content,
          note.categoryId,
          note.isPinned ? 1 : 0,
          note.createdAt,
          note.updatedAt,
        ],
      );
      for (const tagId of tagIds) {
        await tx.runAsync('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)', [
          note.id,
          tagId,
        ]);
      }
    });
  }

  async updateWithTags(note: Note, tagIds: readonly string[]): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `UPDATE notes
            SET title = ?, content = ?, category_id = ?, is_pinned = ?, updated_at = ?
          WHERE id = ?`,
        [
          note.title,
          note.content,
          note.categoryId,
          note.isPinned ? 1 : 0,
          note.updatedAt,
          note.id,
        ],
      );
      await tx.runAsync('DELETE FROM note_tags WHERE note_id = ?', [note.id]);
      for (const tagId of tagIds) {
        await tx.runAsync('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)', [
          note.id,
          tagId,
        ]);
      }
    });
  }

  async findById(id: string): Promise<NoteListItem | null> {
    const row = await this.db.getFirstAsync<NoteRow>(
      `SELECT ${NOTE_COLUMNS} ${NOTE_FROM} WHERE n.id = ?`,
      [id],
    );
    if (!row) {
      return null;
    }
    const tags = await this.tagsByNoteIds([row.id]);
    return { ...mapNote(row), categoryName: row.category_name, tags: tags.get(row.id) ?? [] };
  }

  async list(options: NoteListOptions = {}): Promise<NoteListItem[]> {
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (options.search && options.search.trim().length > 0) {
      const pattern = likePattern(options.search.trim());
      where.push(`(n.title LIKE ? ESCAPE '\\' OR n.content LIKE ? ESCAPE '\\')`);
      params.push(pattern, pattern);
    }
    if (options.categoryId) {
      where.push('n.category_id = ?');
      params.push(options.categoryId);
    }
    if (options.limit !== undefined) {
      params.push(options.limit);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const limitClause = options.limit !== undefined ? 'LIMIT ?' : '';
    const rows = await this.db.getAllAsync<NoteRow>(
      `SELECT ${NOTE_COLUMNS} ${NOTE_FROM} ${whereClause}
        ORDER BY n.is_pinned DESC, n.updated_at DESC ${limitClause}`,
      params,
    );

    const tags = await this.tagsByNoteIds(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...mapNote(row),
      categoryName: row.category_name,
      tags: tags.get(row.id) ?? [],
    }));
  }

  async count(): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM notes',
    );
    return row?.total ?? 0;
  }

  async setPinned(id: string, isPinned: boolean): Promise<boolean> {
    const result = await this.db.runAsync(
      'UPDATE notes SET is_pinned = ? WHERE id = ?',
      [isPinned ? 1 : 0, id],
    );
    return result.changes > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async listCategories(): Promise<NoteCategoryWithUsage[]> {
    const rows = await this.db.getAllAsync<CategoryWithUsageRow>(
      `SELECT c.id, c.name, c.created_at,
              (SELECT COUNT(*) FROM notes n WHERE n.category_id = c.id) AS note_count
         FROM note_categories c
        ORDER BY c.name COLLATE NOCASE ASC`,
    );
    return rows.map((row) => ({ ...mapCategory(row), noteCount: row.note_count }));
  }

  async findCategoryById(id: string): Promise<NoteCategory | null> {
    const row = await this.db.getFirstAsync<CategoryRow>(
      'SELECT id, name, created_at FROM note_categories WHERE id = ?',
      [id],
    );
    return row ? mapCategory(row) : null;
  }

  async findCategoryByName(name: string): Promise<NoteCategory | null> {
    const row = await this.db.getFirstAsync<CategoryRow>(
      'SELECT id, name, created_at FROM note_categories WHERE name = ? COLLATE NOCASE',
      [name],
    );
    return row ? mapCategory(row) : null;
  }

  async insertCategory(category: NoteCategory): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO note_categories (id, name, created_at) VALUES (?, ?, ?)',
      [category.id, category.name, category.createdAt],
    );
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM note_categories WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async listTags(): Promise<NoteTag[]> {
    const rows = await this.db.getAllAsync<TagRow>(
      'SELECT id, name, created_at FROM tags ORDER BY name COLLATE NOCASE ASC',
    );
    return rows.map(mapTag);
  }

  async findTagByName(name: string): Promise<NoteTag | null> {
    const row = await this.db.getFirstAsync<TagRow>(
      'SELECT id, name, created_at FROM tags WHERE name = ? COLLATE NOCASE',
      [name],
    );
    return row ? mapTag(row) : null;
  }

  async insertTag(tag: NoteTag): Promise<void> {
    await this.db.runAsync('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)', [
      tag.id,
      tag.name,
      tag.createdAt,
    ]);
  }

  async deleteTagIfUnused(id: string): Promise<boolean> {
    const result = await this.db.runAsync(
      `DELETE FROM tags
        WHERE id = ?
          AND NOT EXISTS (SELECT 1 FROM note_tags nt WHERE nt.tag_id = ?)`,
      [id, id],
    );
    return result.changes > 0;
  }

  async tagsForNote(noteId: string): Promise<NoteTag[]> {
    const rows = await this.db.getAllAsync<TagRow>(
      `SELECT t.id, t.name, t.created_at
         FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
        WHERE nt.note_id = ?
        ORDER BY t.name COLLATE NOCASE ASC`,
      [noteId],
    );
    return rows.map(mapTag);
  }

  async setNoteTags(noteId: string, tagIds: readonly string[]): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM note_tags WHERE note_id = ?', [noteId]);
      for (const tagId of tagIds) {
        await tx.runAsync('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)', [
          noteId,
          tagId,
        ]);
      }
    });
  }

  /** One grouped query for every tag link of the given notes (avoids N+1). */
  private async tagsByNoteIds(noteIds: string[]): Promise<Map<string, NoteTag[]>> {
    const grouped = new Map<string, NoteTag[]>();
    if (noteIds.length === 0) {
      return grouped;
    }
    const placeholders = noteIds.map(() => '?').join(', ');
    const rows = await this.db.getAllAsync<TagLinkRow>(
      `SELECT nt.note_id, t.id AS tag_id, t.name AS tag_name,
              t.created_at AS tag_created_at
         FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
        WHERE nt.note_id IN (${placeholders})
        ORDER BY t.name COLLATE NOCASE ASC`,
      noteIds,
    );
    for (const row of rows) {
      const list = grouped.get(row.note_id);
      const tag: NoteTag = {
        id: row.tag_id,
        name: row.tag_name,
        createdAt: row.tag_created_at,
      };
      if (list) {
        list.push(tag);
      } else {
        grouped.set(row.note_id, [tag]);
      }
    }
    return grouped;
  }
}
