import type { SettingsRepository } from '@/db/repositories/settings-repository';
import type {
  CachedMediaItem,
  EntertainmentIntelligenceRepository,
  ReleaseDateChange,
} from '@/db/repositories/entertainment-intelligence-repository';
import { formatIsoDateDisplay } from '@/i18n/format';
import type { TranslateFn } from '@/i18n/translate';
import {
  buildUserPreferenceProfile,
  scoreRecommendations,
  toEpisodeRows,
  toMediaRows,
} from './entertainment-intelligence';
import type { EntertainmentService } from './entertainment-service';
import {
  fetchMarvelMovies,
  fetchMarvelSeries,
  fetchNextEpisode,
  fetchProviderTop,
  fetchTrending,
  type TmdbEpisodeAir,
  type TmdbProviderKey,
  type TmdbTitle,
} from './tmdb';

/**
 * Recommendations sync: TMDB trending + provider tops + Marvel dates are
 * fetched, release alerts are picked for what airs soon, top picks are saved
 * into the watchlist (deduped by title), and a display feed is returned for
 * the Discover tab. Everything downstream is injectable so unit tests run
 * offline with fakes.
 */

export const SYNC_INTERVAL_HOURS = 12;
export const MAX_ALERTS_PER_SYNC = 5;
export const MAX_SAVED_PER_SYNC = 10;
export const MAX_TRACKED_SHOWS = 10;
/** Notified-episode memory cap (oldest entries pruned first). */
export const MAX_NOTIFIED_KEYS = 120;

/** app_settings keys (no migration needed). */
export const ENT_API_KEY = 'entertainment.tmdbKey';
export const ENT_FEED = 'entertainment.feed';
export const ENT_NOTIFIED = 'entertainment.notified';
export const ENT_LAST_SYNC = 'entertainment.lastSync';

export interface SyncLabels {
  episodeToday: (show: string, episode: string) => string;
  episodeTomorrow: (show: string, episode: string) => string;
  episodeDate: (show: string, episode: string, date: string) => string;
  movieOutNow: (title: string) => string;
  movieToday: (title: string) => string;
  movieDate: (title: string, date: string) => string;
  recNotes: (vote: string, source: string) => string;
}

export interface ReleaseAlert {
  key: string;
  title: string;
  body: string;
}

export interface FeedEntry {
  tmdbId: number;
  title: string;
  kind: 'movie' | 'series';
  /** e.g. `S2 E4` or empty. */
  episode: string;
  /** `YYYY-MM-DD` or null. */
  date: string | null;
  /** e.g. `TMDB 8.4`. */
  rating: string;
  /** e.g. `Trending this week`, `Top on Netflix`. */
  source: string;
}

export interface SyncResult {
  alerts: ReleaseAlert[];
  /** Notified keys minted this run (caller merges into memory). */
  notifiedKeys: string[];
  /** Watchlist rows created this run. */
  added: number;
  marvel: FeedEntry[];
  trending: FeedEntry[];
  error?: 'network' | 'auth' | 'server';
}

export function episodeKey(episode: TmdbEpisodeAir): string {
  return `s${episode.showId}:S${episode.season}E${episode.episode}`;
}

function episodeLabel(episode: TmdbEpisodeAir): string {
  const name = episode.episodeName !== '' ? ` · ${episode.episodeName}` : '';
  return `S${episode.season} E${episode.episode}${name}`;
}

/** Days from `todayIso` until `dateIso` (both `YYYY-MM-DD`, UTC math). */
export function daysUntil(todayIso: string, dateIso: string): number {
  const dayMs = 86_400_000;
  return Math.round((Date.parse(`${dateIso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / dayMs);
}

/**
 * Picks episode alerts for airings within the next 31 days, soonest first,
 * skipping already-notified episodes. Pure and fully unit-tested.
 */
export function pickEpisodeAlerts(
  episodes: TmdbEpisodeAir[],
  todayIso: string,
  notified: readonly string[],
  labels: SyncLabels,
): ReleaseAlert[] {
  const seen = new Set(notified);
  return episodes
    .map((episode) => ({ episode, diff: daysUntil(todayIso, episode.airDate) }))
    .filter(({ diff }) => diff >= 0 && diff <= 31)
    .sort((a, b) => a.diff - b.diff)
    .filter(({ episode }) => !seen.has(episodeKey(episode)))
    .slice(0, MAX_ALERTS_PER_SYNC)
    .map(({ episode, diff }) => {
      const label = episodeLabel(episode);
      const body =
        diff === 0
          ? labels.episodeToday(episode.showTitle, label)
          : diff === 1
            ? labels.episodeTomorrow(episode.showTitle, label)
            : labels.episodeDate(episode.showTitle, label, episode.airDate);
      return { key: episodeKey(episode), title: episode.showTitle, body };
    });
}

/** Picks movie release alerts (out now / today / dated), soonest first. */
export function pickMovieAlerts(
  movies: TmdbTitle[],
  todayIso: string,
  notified: readonly string[],
  labels: SyncLabels,
): ReleaseAlert[] {
  const seen = new Set(notified);
  return movies
    .filter((movie) => movie.releaseDate !== null)
    .map((movie) => ({
      movie,
      key: `m${movie.tmdbId}:${movie.releaseDate as string}`,
      diff: daysUntil(todayIso, movie.releaseDate as string),
    }))
    .filter(({ diff }) => diff >= -7 && diff <= 31)
    .sort((a, b) => a.diff - b.diff)
    .filter(({ key }) => !seen.has(key))
    .slice(0, MAX_ALERTS_PER_SYNC)
    .map(({ movie, key, diff }) => ({
      key,
      title: movie.title,
      body:
        diff < 0
          ? labels.movieOutNow(movie.title)
          : diff === 0
            ? labels.movieToday(movie.title)
            : labels.movieDate(movie.title, movie.releaseDate as string),
    }));
}

export interface RecommendationPick {
  title: string;
  kind: 'movie' | 'series';
  notes: string;
}

/**
 * Top picks by rating (vote-count floored), deduped by title+kind, capped.
 * `sources` pairs each candidate list with its display label.
 */
export function pickRecommendations(
  sources: { titles: TmdbTitle[]; label: string }[],
  labels: SyncLabels,
  limit = MAX_SAVED_PER_SYNC,
): RecommendationPick[] {
  const seen = new Set<string>();
  const ranked = sources
    .flatMap(({ titles, label }) => titles.map((title) => ({ title, label })))
    .filter(({ title }) => title.voteAverage >= 7 && title.voteCount >= 150)
    .sort((a, b) => b.title.voteAverage - a.title.voteAverage);
  const picks: RecommendationPick[] = [];
  for (const { title, label } of ranked) {
    if (picks.length >= limit) {
      break;
    }
    const key = `${title.mediaType}:${title.title.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    picks.push({
      title: title.title,
      kind: title.mediaType === 'tv' ? 'series' : 'movie',
      notes: labels.recNotes(title.voteAverage.toFixed(1), label),
    });
  }
  return picks;
}

export interface SyncServices {
  entertainment: EntertainmentService;
  notify: (title: string, body: string) => Promise<unknown>;
  intelRepo?: EntertainmentIntelligenceRepository;
}

function toFeedEntry(title: TmdbTitle, source: string, episode = ''): FeedEntry {
  return {
    tmdbId: title.tmdbId,
    title: title.title,
    kind: title.mediaType === 'tv' ? 'series' : 'movie',
    episode,
    date: title.releaseDate,
    rating: title.voteAverage > 0 ? `TMDB ${title.voteAverage.toFixed(1)}` : '',
    source,
  };
}

/**
 * Runs one full sync: fetches, alerts, saves picks, builds the Discover
 * feed, and persists to the offline SQLite cache when intelRepo is available.
 */
export async function runEntertainmentSync(options: {
  fetchImpl?: typeof fetch;
  apiKey: string;
  todayIso: string;
  notifiedKeys: readonly string[];
  labels: SyncLabels;
  trendingLabel: string;
  providerLabels: Record<TmdbProviderKey, string>;
  services: SyncServices;
}): Promise<SyncResult> {
  const { fetchImpl = fetch, apiKey, todayIso, labels, services } = options;
  const notified = new Set(options.notifiedKeys);
  const minted: string[] = [];

  const trending = await fetchTrending(fetchImpl, apiKey);
  if (trending.error) {
    return { alerts: [], notifiedKeys: [], added: 0, marvel: [], trending: [], error: trending.error };
  }
  const weekAgo = new Date(`${todayIso}T00:00:00Z`);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const fromDate = weekAgo.toISOString().slice(0, 10);
  const [marvelMovies, marvelSeries] = await Promise.all([
    fetchMarvelMovies(fetchImpl, apiKey, fromDate),
    fetchMarvelSeries(fetchImpl, apiKey),
  ]);

  const providerTitles: { titles: TmdbTitle[]; label: string; provider: TmdbProviderKey }[] = [];
  for (const provider of Object.keys(options.providerLabels) as TmdbProviderKey[]) {
    const [movies, series] = await Promise.all([
      fetchProviderTop(fetchImpl, apiKey, provider, 'movie'),
      fetchProviderTop(fetchImpl, apiKey, provider, 'tv'),
    ]);
    if (!movies.error) {
      providerTitles.push({
        titles: movies.titles.slice(0, 6),
        label: options.providerLabels[provider],
        provider,
      });
    }
    if (!series.error) {
      providerTitles.push({
        titles: series.titles.slice(0, 6),
        label: options.providerLabels[provider],
        provider,
      });
    }
  }

  const tracked = (marvelSeries.error ? [] : marvelSeries.titles).slice(0, MAX_TRACKED_SHOWS);
  const episodes: TmdbEpisodeAir[] = [];
  for (const show of tracked) {
    const details = await fetchNextEpisode(fetchImpl, apiKey, show.tmdbId, show.title);
    if (!details.error && details.episode) {
      episodes.push(details.episode);
    }
  }

  // Detect release date changes via SQLite cache
  let dateChanges: ReleaseDateChange[] = [];
  if (services.intelRepo) {
    const allCandidates = [
      ...(marvelMovies.error ? [] : marvelMovies.titles),
      ...providerTitles.flatMap((pt) => pt.titles),
      ...trending.titles,
    ];
    dateChanges = await services.intelRepo.detectReleaseDateChanges(
      allCandidates.map((c) => ({
        id: `tmdb:${c.mediaType}:${c.tmdbId}`,
        tmdbId: c.tmdbId,
        title: c.title,
        mediaType: c.mediaType,
        releaseDate: c.releaseDate,
      })),
    );
  }

  // Profile preferences & score smart recommendations for Bangladesh
  let libraryItems: import('@/types/entertainment').WatchItem[] = [];
  try {
    libraryItems = await services.entertainment.list({});
  } catch {
    libraryItems = [];
  }
  const userProfile = buildUserPreferenceProfile(libraryItems);
  const existingKeys = new Set(libraryItems.map((u) => `${u.kind}:${u.title.trim().toLowerCase()}`));
  const scoredRecs = scoreRecommendations(
    [
      ...trending.titles,
      ...providerTitles.flatMap((pt) => pt.titles),
    ],
    userProfile,
    existingKeys,
    'BD',
  );

  // Base alerts: episodes, movies, and date changes
  const epAlerts = pickEpisodeAlerts(episodes, todayIso, Array.from(notified), labels);
  const movieAlerts = pickMovieAlerts(marvelMovies.error ? [] : marvelMovies.titles, todayIso, Array.from(notified), labels);
  const dateAlerts: ReleaseAlert[] = dateChanges
    .map((change) => ({
      key: `changed:${change.tmdbId}:${change.newReleaseDate}`,
      title: change.title,
      body: `Release date moved for ${change.title}: now ${change.newReleaseDate} (was ${change.oldReleaseDate ?? 'TBA'})`,
    }))
    .filter((a) => !notified.has(a.key));

  const alerts = [...epAlerts, ...movieAlerts, ...dateAlerts].slice(0, MAX_ALERTS_PER_SYNC);
  for (const alert of alerts) {
    try {
      await services.notify(alert.title, alert.body);
    } catch {
      // Notification errors never fail the sync
    }
    notified.add(alert.key);
    minted.push(alert.key);
  }

  // Save top recommendations into the user's watchlist with tmdb source
  const recCandidates = [
    { titles: trending.titles, label: options.trendingLabel },
    ...providerTitles,
  ];
  const picks = pickRecommendations(recCandidates, labels);
  let added = 0;
  for (const pick of picks) {
    try {
      const { created } = await services.entertainment.saveSpotlight(pick.title, pick.kind, {
        source: 'tmdb',
        notes: pick.notes,
      });
      if (created) {
        added += 1;
      }
    } catch {
      // Ignore individual save errors
    }
  }

  // Cache to offline SQLite database if intelRepo is provided
  if (services.intelRepo) {
    const nowIso = new Date().toISOString();
    const mediaToStore: CachedMediaItem[] = [
      ...toMediaRows(marvelMovies.error ? [] : marvelMovies.titles, 'marvel', nowIso, 'BD'),
      ...toMediaRows(trending.titles, 'trending', nowIso, 'BD'),
      ...toMediaRows(scoredRecs.map((s) => s.title), 'for_you', nowIso, 'BD'),
    ];
    await services.intelRepo.upsertMediaBatch(mediaToStore);
    const episodesToStore = toEpisodeRows(episodes, nowIso, true);
    await services.intelRepo.upsertEpisodesBatch(episodesToStore);
    if (alerts.length > 0) {
      await services.intelRepo.recordNotifiedBatch(
        alerts.map((a) => ({
          id: a.key,
          eventType: a.key.startsWith('s')
            ? 'episode_air'
            : a.key.startsWith('changed:')
              ? 'release_date_change'
              : 'season_premiere',
          title: a.title,
          body: a.body,
          notifiedAt: nowIso,
        })),
      );
    }
  }

  return {
    alerts,
    notifiedKeys: minted,
    added,
    marvel: [
      ...(marvelMovies.error ? [] : marvelMovies.titles).slice(0, 10).map((title) => toFeedEntry(title, 'Marvel Universe')),
      ...episodes.slice(0, 10).map((episode) =>
        toFeedEntry(
          {
            tmdbId: episode.showId,
            mediaType: 'tv',
            title: episode.showTitle,
            overview: '',
            releaseDate: episode.airDate,
            voteAverage: 0,
            voteCount: 0,
          },
          'New Episode',
          `S${episode.season} E${episode.episode}`,
        ),
      ),
    ],
    trending: trending.titles.slice(0, 10).map((title) => toFeedEntry(title, options.trendingLabel)),
  };
}

function readNotifiedKeys(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

function buildLabels(t: TranslateFn): SyncLabels {
  const dateOf = (iso: string) => formatIsoDateDisplay(iso, t);
  return {
    episodeToday: (show, episode) => t('entertainment.sync.episodeToday', { show, episode }),
    episodeTomorrow: (show, episode) => t('entertainment.sync.episodeTomorrow', { show, episode }),
    episodeDate: (show, episode, date) =>
      t('entertainment.sync.episodeDate', { show, episode, date: dateOf(date) }),
    movieOutNow: (title) => t('entertainment.sync.movieOutNow', { title }),
    movieToday: (title) => t('entertainment.sync.movieToday', { title }),
    movieDate: (title, date) => t('entertainment.sync.movieDate', { title, date: dateOf(date) }),
    recNotes: (vote, source) => t('entertainment.sync.recNotes', { vote, source }),
  };
}

export interface SyncSummary {
  ran: boolean;
  added: number;
  alerts: number;
  error?: 'network' | 'auth' | 'server';
}

/**
 * Due-gated sync shared by the manual button (`force: true`) and the silent
 * cold-start run. Reads the API key, memory, and feed itself; persists feed,
 * memory (pruned), and timestamp. Never throws for network/auth failures
 * (reports `ran: false`); storage failures propagate for UI mapping.
 */
export async function syncIfDue(options: {
  fetchImpl?: typeof fetch;
  service: EntertainmentService;
  settings: SettingsRepository;
  intelRepo?: EntertainmentIntelligenceRepository;
  t: TranslateFn;
  todayIso: string;
  trendingLabel: string;
  providerLabels: Record<TmdbProviderKey, string>;
  notify: (title: string, body: string) => Promise<unknown>;
  force?: boolean;
}): Promise<SyncSummary> {
  const { service, settings, intelRepo, t, todayIso, force = false } = options;
  const [apiKey, lastSyncRaw, notifiedRaw] = await Promise.all([
    settings.get(ENT_API_KEY),
    settings.get(ENT_LAST_SYNC),
    settings.get(ENT_NOTIFIED),
  ]);
  const key = (apiKey ?? '').trim() || (process.env.EXPO_PUBLIC_TMDB_API_KEY ?? '').trim();
  if (key === '') {
    return { ran: false, added: 0, alerts: 0 };
  }
  if (!force && lastSyncRaw) {
    const last = Date.parse(lastSyncRaw);
    if (!Number.isNaN(last) && Date.now() - last < SYNC_INTERVAL_HOURS * 3_600_000) {
      return { ran: false, added: 0, alerts: 0 };
    }
  }
  const result = await runEntertainmentSync({
    fetchImpl: options.fetchImpl,
    apiKey: key,
    todayIso,
    notifiedKeys: readNotifiedKeys(notifiedRaw),
    labels: buildLabels(t),
    trendingLabel: options.trendingLabel,
    providerLabels: options.providerLabels,
    services: { entertainment: service, notify: options.notify, intelRepo },
  });
  if (result.error) {
    return { ran: false, added: 0, alerts: 0, error: result.error };
  }
  const memory = [...readNotifiedKeys(notifiedRaw), ...result.notifiedKeys].slice(-MAX_NOTIFIED_KEYS);
  await settings.set(ENT_NOTIFIED, JSON.stringify(memory));
  await settings.set(ENT_FEED, JSON.stringify({ marvel: result.marvel, trending: result.trending }));
  await settings.set(ENT_LAST_SYNC, new Date().toISOString());
  return { ran: true, added: result.added, alerts: result.alerts.length };
}

export interface SyncFeed {
  marvel: FeedEntry[];
  trending: FeedEntry[];
}

export function readFeed(raw: string | null): SyncFeed {
  const empty: SyncFeed = { marvel: [], trending: [] };
  if (!raw) {
    return empty;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SyncFeed>;
    const clean = (entries: unknown): FeedEntry[] =>
      Array.isArray(entries)
        ? entries.filter(
            (entry): entry is FeedEntry =>
              typeof entry === 'object' &&
              entry !== null &&
              typeof (entry as FeedEntry).title === 'string',
          )
        : [];
    return { marvel: clean(parsed.marvel), trending: clean(parsed.trending) };
  } catch {
    return empty;
  }
}
