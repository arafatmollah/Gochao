import type { Migration } from './types';

/**
 * 014 — Entertainment Intelligence.
 *
 * Adds persistent offline caches for:
 * - entertainment_media: Cached upcoming, Marvel, trending, and For You media items.
 * - entertainment_episodes: Upcoming and tracked series episode air dates.
 * - entertainment_notified_events: Deduplication audit log for smart notifications.
 */
export const migration014: Migration = {
  version: 14,
  name: 'entertainment-intelligence',
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE entertainment_media (
        id TEXT PRIMARY KEY,
        tmdb_id INTEGER NOT NULL,
        media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
        title TEXT NOT NULL,
        overview TEXT,
        release_date TEXT,
        vote_average REAL NOT NULL DEFAULT 0,
        vote_count INTEGER NOT NULL DEFAULT 0,
        genres TEXT,
        providers TEXT,
        watch_region TEXT NOT NULL DEFAULT 'BD',
        is_marvel INTEGER NOT NULL DEFAULT 0,
        phase TEXT,
        category TEXT NOT NULL CHECK (category IN ('upcoming', 'marvel', 'for_you', 'trending')),
        last_synced_at TEXT NOT NULL
      );

      CREATE INDEX idx_ent_media_category_date ON entertainment_media (category, release_date);
      CREATE INDEX idx_ent_media_marvel ON entertainment_media (is_marvel, release_date);
      CREATE INDEX idx_ent_media_type_date ON entertainment_media (media_type, release_date);

      CREATE TABLE entertainment_episodes (
        id TEXT PRIMARY KEY,
        show_tmdb_id INTEGER NOT NULL,
        show_title TEXT NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        air_date TEXT NOT NULL,
        overview TEXT,
        is_marvel INTEGER NOT NULL DEFAULT 0,
        last_synced_at TEXT NOT NULL
      );

      CREATE INDEX idx_ent_episodes_air_date ON entertainment_episodes (air_date);
      CREATE INDEX idx_ent_episodes_show ON entertainment_episodes (show_tmdb_id, season_number, episode_number);

      CREATE TABLE entertainment_notified_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        notified_at TEXT NOT NULL
      );

      CREATE INDEX idx_ent_notified_type ON entertainment_notified_events (event_type, notified_at);
    `);
  },
};
