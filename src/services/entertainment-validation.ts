import {
  WATCH_NOTES_MAX_LENGTH,
  WATCH_RATING_MAX,
  WATCH_RATING_MIN,
  WATCH_TITLE_MAX_LENGTH,
  WATCH_URL_MAX_LENGTH,
  WATCH_KINDS,
  WATCH_STATUSES,
} from '@/types/entertainment';

/**
 * Shared watchlist validation rules, used both by the form (field-level
 * feedback) and by the entertainment service (authoritative check before
 * persisting).
 *
 * Validators return a stable machine-readable code (or null when valid).
 * The UI translates codes into localized copy via `translateValidationCode`;
 * services wrap them in `AppError('validation', code)`.
 */

export type EntertainmentValidationCode =
  | 'watch_title_required'
  | 'watch_title_too_long'
  | 'watch_kind_invalid'
  | 'watch_status_invalid'
  | 'watch_url_invalid'
  | 'watch_url_too_long'
  | 'watch_rating_invalid'
  | 'watch_notes_too_long';

export function validateWatchTitle(title: string): EntertainmentValidationCode | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return 'watch_title_required';
  }
  if (trimmed.length > WATCH_TITLE_MAX_LENGTH) {
    return 'watch_title_too_long';
  }
  return null;
}

export function validateWatchKind(kind: string): EntertainmentValidationCode | null {
  if (!(WATCH_KINDS as readonly string[]).includes(kind)) {
    return 'watch_kind_invalid';
  }
  return null;
}

export function validateWatchStatus(status: string): EntertainmentValidationCode | null {
  if (!(WATCH_STATUSES as readonly string[]).includes(status)) {
    return 'watch_status_invalid';
  }
  return null;
}

/**
 * Links are optional, but when present they must be `http(s)` URLs. A
 * mistyped link never blocks saving — it only fails this check so the user
 * can fix it before tapping "open".
 */
export function validateWatchUrl(url: string | null | undefined): EntertainmentValidationCode | null {
  if (url == null || url.trim() === '') {
    return null;
  }
  const trimmed = url.trim();
  if (trimmed.length > WATCH_URL_MAX_LENGTH) {
    return 'watch_url_too_long';
  }
  if (!/^https?:\/\/\S+$/i.test(trimmed)) {
    return 'watch_url_invalid';
  }
  return null;
}

export function validateWatchRating(
  rating: number | null | undefined,
): EntertainmentValidationCode | null {
  if (rating == null) {
    return null;
  }
  if (!Number.isInteger(rating) || rating < WATCH_RATING_MIN || rating > WATCH_RATING_MAX) {
    return 'watch_rating_invalid';
  }
  return null;
}

export function validateWatchNotes(
  notes: string | null | undefined,
): EntertainmentValidationCode | null {
  if (notes && notes.trim().length > WATCH_NOTES_MAX_LENGTH) {
    return 'watch_notes_too_long';
  }
  return null;
}

/** True for YouTube watch/share links (used for the row icon). */
export function isYouTubeUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  return /(^|\.)(youtube\.com|youtu\.be)($|[/:?#])/i.test(url.replace(/^https?:\/\//i, ''));
}
