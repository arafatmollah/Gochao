/**
 * Entertainment library types: the user's own watchlist plus the static
 * Spotlight catalog (offline highlights — see `catalog.ts`).
 */

export const WATCH_KINDS = ['movie', 'series', 'video'] as const;
export type WatchKind = (typeof WATCH_KINDS)[number];

export const WATCH_STATUSES = ['want_to_watch', 'watching', 'watched'] as const;
export type WatchStatus = (typeof WATCH_STATUSES)[number];

export const WATCH_TITLE_MAX_LENGTH = 160;
export const WATCH_URL_MAX_LENGTH = 500;
export const WATCH_NOTES_MAX_LENGTH = 2000;

export const WATCH_RATING_MIN = 1;
export const WATCH_RATING_MAX = 5;

export interface WatchItem {
  id: string;
  title: string;
  kind: WatchKind;
  status: WatchStatus;
  /** Optional link (YouTube or anywhere else). */
  url: string | null;
  /** 1–5 stars, or null when unrated. */
  rating: number | null;
  notes: string | null;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
}

export interface CreateWatchItemInput {
  title: string;
  kind?: WatchKind;
  status?: WatchStatus;
  url?: string | null;
  rating?: number | null;
  notes?: string | null;
}

export interface UpdateWatchItemInput {
  title?: string;
  kind?: WatchKind;
  status?: WatchStatus;
  url?: string | null;
  rating?: number | null;
  notes?: string | null;
}

export interface WatchFilter {
  status?: WatchStatus;
  kind?: WatchKind;
  /** Case-insensitive substring match on title. */
  search?: string;
  limit?: number;
  offset?: number;
}

/** One curated highlight in the offline Spotlight catalog. */
export interface SpotlightEntry {
  id: string;
  title: string;
  kind: WatchKind;
  /** Release year (or expected year for upcoming titles). */
  year: string;
  blurb: string;
  section: 'upcoming' | 'acclaimed';
}
