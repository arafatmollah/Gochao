import type { SqlDatabase, SqlParam } from '../sql';

export interface CachedMediaItem {
  id: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  overview: string;
  releaseDate: string | null;
  voteAverage: number;
  voteCount: number;
  genres: string[];
  providers: string[];
  watchRegion: string;
  isMarvel: boolean;
  phase?: string | null;
  category: 'upcoming' | 'marvel' | 'for_you' | 'trending';
  lastSyncedAt: string;
}

export interface CachedEpisodeItem {
  id: string;
  showTmdbId: number;
  showTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string;
  overview?: string | null;
  isMarvel: boolean;
  lastSyncedAt: string;
}

export interface NotifiedEvent {
  id: string;
  eventType: 'episode_air' | 'season_premiere' | 'release_date_change' | 'recommendation';
  title: string;
  body: string;
  notifiedAt: string;
}

export interface ReleaseDateChange {
  mediaId: string;
  tmdbId: number;
  title: string;
  mediaType: 'movie' | 'tv';
  oldReleaseDate: string | null;
  newReleaseDate: string;
}

interface MediaRow {
  id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  overview: string | null;
  release_date: string | null;
  vote_average: number;
  vote_count: number;
  genres: string | null;
  providers: string | null;
  watch_region: string;
  is_marvel: number;
  phase: string | null;
  category: 'upcoming' | 'marvel' | 'for_you' | 'trending';
  last_synced_at: string;
}

interface EpisodeRow {
  id: string;
  show_tmdb_id: number;
  show_title: string;
  season_number: number;
  episode_number: number;
  name: string;
  air_date: string;
  overview: string | null;
  is_marvel: number;
  last_synced_at: string;
}

interface NotifiedRow {
  id: string;
  event_type: NotifiedEvent['eventType'];
  title: string;
  body: string;
  notified_at: string;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function mapMediaRow(row: MediaRow): CachedMediaItem {
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    title: row.title,
    overview: row.overview ?? '',
    releaseDate: row.release_date,
    voteAverage: row.vote_average,
    voteCount: row.vote_count,
    genres: parseJsonArray(row.genres),
    providers: parseJsonArray(row.providers),
    watchRegion: row.watch_region,
    isMarvel: row.is_marvel === 1,
    phase: row.phase,
    category: row.category,
    lastSyncedAt: row.last_synced_at,
  };
}

function mapEpisodeRow(row: EpisodeRow): CachedEpisodeItem {
  return {
    id: row.id,
    showTmdbId: row.show_tmdb_id,
    showTitle: row.show_title,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    name: row.name,
    airDate: row.air_date,
    overview: row.overview,
    isMarvel: row.is_marvel === 1,
    lastSyncedAt: row.last_synced_at,
  };
}

export interface EntertainmentIntelligenceRepository {
  upsertMediaBatch(items: CachedMediaItem[]): Promise<void>;
  getMediaByCategory(category: CachedMediaItem['category'], limit?: number): Promise<CachedMediaItem[]>;
  getMarvelSlate(limit?: number): Promise<CachedMediaItem[]>;
  getUpcomingReleases(fromDateIso: string, limit?: number): Promise<CachedMediaItem[]>;
  upsertEpisodesBatch(episodes: CachedEpisodeItem[]): Promise<void>;
  getUpcomingEpisodes(fromDateIso: string, limit?: number): Promise<CachedEpisodeItem[]>;
  getMarvelEpisodes(fromDateIso?: string, limit?: number): Promise<CachedEpisodeItem[]>;
  detectReleaseDateChanges(
    incoming: Pick<CachedMediaItem, 'id' | 'tmdbId' | 'title' | 'mediaType' | 'releaseDate'>[],
  ): Promise<ReleaseDateChange[]>;
  hasEventBeenNotified(id: string): Promise<boolean>;
  recordNotifiedBatch(events: NotifiedEvent[]): Promise<void>;
  getNotifiedEvents(limit?: number): Promise<NotifiedEvent[]>;
}

export class SqliteEntertainmentIntelligenceRepository implements EntertainmentIntelligenceRepository {
  constructor(private readonly db: SqlDatabase) {}

  async upsertMediaBatch(items: CachedMediaItem[]): Promise<void> {
    if (items.length === 0) return;
    for (const item of items) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO entertainment_media (
          id, tmdb_id, media_type, title, overview, release_date,
          vote_average, vote_count, genres, providers, watch_region,
          is_marvel, phase, category, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.tmdbId,
          item.mediaType,
          item.title,
          item.overview,
          item.releaseDate,
          item.voteAverage,
          item.voteCount,
          JSON.stringify(item.genres),
          JSON.stringify(item.providers),
          item.watchRegion,
          item.isMarvel ? 1 : 0,
          item.phase ?? null,
          item.category,
          item.lastSyncedAt,
        ],
      );
    }
  }

  async getMediaByCategory(
    category: CachedMediaItem['category'],
    limit = 50,
  ): Promise<CachedMediaItem[]> {
    const rows = await this.db.getAllAsync<MediaRow>(
      `SELECT * FROM entertainment_media
       WHERE category = ?
       ORDER BY CASE WHEN release_date IS NULL THEN 1 ELSE 0 END, release_date ASC
       LIMIT ?`,
      [category, limit],
    );
    return rows.map(mapMediaRow);
  }

  async getMarvelSlate(limit = 60): Promise<CachedMediaItem[]> {
    const rows = await this.db.getAllAsync<MediaRow>(
      `SELECT * FROM entertainment_media
       WHERE is_marvel = 1
       ORDER BY CASE WHEN release_date IS NULL THEN 1 ELSE 0 END, release_date ASC
       LIMIT ?`,
      [limit],
    );
    return rows.map(mapMediaRow);
  }

  async getUpcomingReleases(fromDateIso: string, limit = 50): Promise<CachedMediaItem[]> {
    const rows = await this.db.getAllAsync<MediaRow>(
      `SELECT * FROM entertainment_media
       WHERE release_date >= ?
       ORDER BY release_date ASC
       LIMIT ?`,
      [fromDateIso, limit],
    );
    return rows.map(mapMediaRow);
  }

  async upsertEpisodesBatch(episodes: CachedEpisodeItem[]): Promise<void> {
    if (episodes.length === 0) return;
    for (const ep of episodes) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO entertainment_episodes (
          id, show_tmdb_id, show_title, season_number, episode_number,
          name, air_date, overview, is_marvel, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ep.id,
          ep.showTmdbId,
          ep.showTitle,
          ep.seasonNumber,
          ep.episodeNumber,
          ep.name,
          ep.airDate,
          ep.overview ?? null,
          ep.isMarvel ? 1 : 0,
          ep.lastSyncedAt,
        ],
      );
    }
  }

  async getUpcomingEpisodes(fromDateIso: string, limit = 50): Promise<CachedEpisodeItem[]> {
    const rows = await this.db.getAllAsync<EpisodeRow>(
      `SELECT * FROM entertainment_episodes
       WHERE air_date >= ?
       ORDER BY air_date ASC
       LIMIT ?`,
      [fromDateIso, limit],
    );
    return rows.map(mapEpisodeRow);
  }

  async getMarvelEpisodes(fromDateIso = '', limit = 50): Promise<CachedEpisodeItem[]> {
    const sql =
      fromDateIso !== ''
        ? `SELECT * FROM entertainment_episodes
           WHERE is_marvel = 1 AND air_date >= ?
           ORDER BY air_date ASC
           LIMIT ?`
        : `SELECT * FROM entertainment_episodes
           WHERE is_marvel = 1
           ORDER BY air_date DESC
           LIMIT ?`;
    const params: SqlParam[] = fromDateIso !== '' ? [fromDateIso, limit] : [limit];
    const rows = await this.db.getAllAsync<EpisodeRow>(sql, params);
    return rows.map(mapEpisodeRow);
  }

  async detectReleaseDateChanges(
    incoming: Pick<CachedMediaItem, 'id' | 'tmdbId' | 'title' | 'mediaType' | 'releaseDate'>[],
  ): Promise<ReleaseDateChange[]> {
    const changes: ReleaseDateChange[] = [];
    for (const item of incoming) {
      if (!item.releaseDate) continue;
      const existing = await this.db.getFirstAsync<{ release_date: string | null }>(
        `SELECT release_date FROM entertainment_media WHERE id = ? OR tmdb_id = ? LIMIT 1`,
        [item.id, item.tmdbId],
      );
      if (existing && existing.release_date && existing.release_date !== item.releaseDate) {
        changes.push({
          mediaId: item.id,
          tmdbId: item.tmdbId,
          title: item.title,
          mediaType: item.mediaType,
          oldReleaseDate: existing.release_date,
          newReleaseDate: item.releaseDate,
        });
      }
    }
    return changes;
  }

  async hasEventBeenNotified(id: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id FROM entertainment_notified_events WHERE id = ? LIMIT 1`,
      [id],
    );
    return row !== null;
  }

  async recordNotifiedBatch(events: NotifiedEvent[]): Promise<void> {
    if (events.length === 0) return;
    for (const ev of events) {
      await this.db.runAsync(
        `INSERT OR IGNORE INTO entertainment_notified_events (id, event_type, title, body, notified_at)
         VALUES (?, ?, ?, ?, ?)`,
        [ev.id, ev.eventType, ev.title, ev.body, ev.notifiedAt],
      );
    }
  }

  async getNotifiedEvents(limit = 100): Promise<NotifiedEvent[]> {
    const rows = await this.db.getAllAsync<NotifiedRow>(
      `SELECT * FROM entertainment_notified_events ORDER BY notified_at DESC LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      title: r.title,
      body: r.body,
      notifiedAt: r.notified_at,
    }));
  }
}
