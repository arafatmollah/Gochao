import type { Migration } from './types';

/**
 * 005 — Notes, note categories, and tags (master prompt Module C / Phase 4).
 *
 * Plain-text notes only for the MVP; the model stays extensible for future
 * attachments, checklists, and richer formatting by keeping content opaque
 * and metadata in separate tables.
 *
 * A note needs a title or body text (CHECK invariant), never both empty.
 * Categories detach on delete (`ON DELETE SET NULL`) so removing a category
 * never destroys note content; tags are pure labels and their links cascade
 * with the note or the tag.
 *
 * Listing order is "pinned first, then most recently modified", served by the
 * composite index below. Search uses parameterized LIKE with an escape char
 * (see NoteRepository), never string-concatenated input (rule 8).
 */
export const migration005: Migration = {
  version: 5,
  name: 'notes',
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE note_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        created_at TEXT NOT NULL,
        UNIQUE (name COLLATE NOCASE)
      );

      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        category_id TEXT REFERENCES note_categories(id) ON DELETE SET NULL,
        is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (length(trim(title)) > 0 OR length(trim(content)) > 0)
      );

      CREATE TABLE tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        created_at TEXT NOT NULL,
        UNIQUE (name COLLATE NOCASE)
      );

      CREATE TABLE note_tags (
        note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (note_id, tag_id)
      );

      CREATE INDEX idx_notes_pinned_updated
        ON notes (is_pinned DESC, updated_at DESC);
      CREATE INDEX idx_notes_category ON notes (category_id);
      CREATE INDEX idx_note_tags_tag ON note_tags (tag_id);
    `);
  },
};
