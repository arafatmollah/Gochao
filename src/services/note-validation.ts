import {
  NOTE_CATEGORY_NAME_MAX_LENGTH,
  NOTE_CONTENT_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
} from '@/types/note';

/** Pure validation for notes; returns a stable code or null when valid. */

export function validateNoteBody(title: string, content: string): string | null {
  if (title.trim().length === 0 && content.trim().length === 0) {
    return 'note_empty';
  }
  return null;
}

export function validateNoteTitleLength(title: string): string | null {
  return title.length > NOTE_TITLE_MAX_LENGTH ? 'note_title_too_long' : null;
}

export function validateNoteContentLength(content: string): string | null {
  return content.length > NOTE_CONTENT_MAX_LENGTH ? 'note_content_too_long' : null;
}

export function validateNoteCategoryName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'note_category_name_required';
  }
  if (trimmed.length > NOTE_CATEGORY_NAME_MAX_LENGTH) {
    return 'note_category_name_too_long';
  }
  return null;
}

export function validateTagName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'tag_name_required';
  }
  if (trimmed.length > TAG_NAME_MAX_LENGTH) {
    return 'tag_name_too_long';
  }
  return null;
}
