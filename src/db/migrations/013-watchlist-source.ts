import type { Migration } from './types';

/**
 * 013 — Watchlist recommendation source.
 *
 * Adds `watchlist_items.source` (`user` for hand-added rows, `tmdb` for rows
 * saved from TMDB recommendations), so the library can badge and filter
 * synced picks without touching titles or notes. Existing rows default to
 * `user`, which is exactly what they are.
 */
export const migration013: Migration = {
  version: 13,
  name: 'watchlist-source',
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE watchlist_items
        ADD COLUMN source TEXT NOT NULL DEFAULT 'user'
        CHECK (source IN ('user', 'tmdb'));
    `);
  },
};
