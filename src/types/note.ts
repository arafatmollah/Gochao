/** Plain-text note domain types (master prompt Module C). */

export const NOTE_TITLE_MAX_LENGTH = 120;
export const NOTE_CONTENT_MAX_LENGTH = 20_000;
export const NOTE_CATEGORY_NAME_MAX_LENGTH = 40;
export const TAG_NAME_MAX_LENGTH = 40;

export interface NoteCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface NoteCategoryWithUsage extends NoteCategory {
  noteCount: number;
}

export interface NoteTag {
  id: string;
  name: string;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  categoryId: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A note with its display metadata resolved for list and detail views. */
export interface NoteListItem extends Note {
  categoryName: string | null;
  tags: NoteTag[];
}

export interface NoteListOptions {
  /** Case-insensitive substring match against title and content. */
  search?: string;
  /** Restrict to one category; omitted means every category. */
  categoryId?: string;
  limit?: number;
}

export interface CreateNoteInput {
  title: string;
  content: string;
  categoryId?: string | null;
  /** Free-text tag names; created on demand and deduplicated case-insensitively. */
  tagNames?: string[];
  isPinned?: boolean;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  /** `null` clears the category; omitted leaves it unchanged. */
  categoryId?: string | null;
  /** When provided, replaces the note's whole tag set. */
  tagNames?: string[];
  isPinned?: boolean;
}
