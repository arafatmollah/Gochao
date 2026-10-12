import type { Migration } from './types';

/**
 * 010 — Entertainment watchlist (personal media library).
 *
 * Model decisions:
 *
 * - `watchlist_items` is the only table: everything the user saves —
 *   movies, series, YouTube videos — is one row with a `kind`, a watch
 *   `status`, an optional link, an optional 1–5 star rating, and notes.
 *   There is no catalog table: the Discover highlights ship as a static,
 *   clearly-labeled data file (`features/entertainment/catalog.ts`) because
 *   live listings would need a network API key, which an offline-first app
 *   with no backend cannot honestly promise. Saving a spotlight entry
 *   copies it into the watchlist as an ordinary row.
 * - Links are validated as `http(s)` URLs in the service; opening them is a
 *   UI concern (in-app browser). A dead or mistyped link never blocks
 *   saving — the title is the record, the link is a convenience.
 * - Ratings are optional (`NULL` = unrated). Deleting an item is allowed —
 *   a watchlist is a personal scratch list, not history the app must keep.
 */
export const migration010: Migration = {
  version: 10,
  name: 'entertainment',
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE watchlist_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        kind TEXT NOT NULL DEFAULT 'movie' CHECK (
          kind IN ('movie', 'series', 'video')
        ),
        status TEXT NOT NULL DEFAULT 'want_to_watch' CHECK (
          status IN ('want_to_watch', 'watching', 'watched')
        ),
        url TEXT,
        rating INTEGER CHECK (
          rating IS NULL OR (rating >= 1 AND rating <= 5)
        ),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_watchlist_status_updated
        ON watchlist_items (status, updated_at DESC);
      CREATE INDEX idx_watchlist_kind ON watchlist_items (kind);
    `);
  },
};
