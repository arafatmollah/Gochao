import type {
  CachedEpisodeItem,
  CachedMediaItem,
  NotifiedEvent,
  ReleaseDateChange,
} from '@/db/repositories/entertainment-intelligence-repository';
import type { WatchItem, WatchKind } from '@/types/entertainment';
import { daysUntil } from './entertainment-sync';
import type { TmdbEpisodeAir, TmdbProviderKey, TmdbTitle } from './tmdb';

export interface UserPreferenceProfile {
  preferredKinds: Set<WatchKind>;
  preferredGenres: Set<string>;
  ratedTitlesCount: number;
}

/**
 * Builds a user preference profile based on the user's existing offline watchlist.
 */
export function buildUserPreferenceProfile(watchlist: WatchItem[]): UserPreferenceProfile {
  const kindCounts: Record<WatchKind, number> = { movie: 0, series: 0, video: 0 };
  const genres = new Set<string>();
  let ratedCount = 0;

  for (const item of watchlist) {
    kindCounts[item.kind] = (kindCounts[item.kind] ?? 0) + 1;
    if (item.rating && item.rating >= 4) {
      ratedCount += 1;
      // In notes or title, check common keywords
      const text = `${item.title} ${item.notes ?? ''}`.toLowerCase();
      if (/sci-?fi|space|galaxy|superhero|marvel|future/i.test(text)) {
        genres.add('Sci-Fi');
        genres.add('Action');
      }
      if (/action|thriller|agent|fight|mission/i.test(text)) {
        genres.add('Action');
        genres.add('Thriller');
      }
      if (/drama|crime|mystery|detective/i.test(text)) {
        genres.add('Drama');
        genres.add('Crime');
      }
      if (/comedy|funny|sitcom/i.test(text)) {
        genres.add('Comedy');
      }
      if (/anime|animation|cartoon/i.test(text)) {
        genres.add('Animation');
      }
    }
  }

  const preferredKinds = new Set<WatchKind>();
  if (kindCounts.movie >= kindCounts.series) {
    preferredKinds.add('movie');
  }
  if (kindCounts.series >= kindCounts.movie) {
    preferredKinds.add('series');
  }
  if (preferredKinds.size === 0) {
    preferredKinds.add('movie');
    preferredKinds.add('series');
  }

  return {
    preferredKinds,
    preferredGenres: genres,
    ratedTitlesCount: ratedCount,
  };
}

export interface ScoredRecommendation {
  title: TmdbTitle;
  score: number;
  matchReason: string;
  provider?: TmdbProviderKey;
  watchRegion: string;
}

/**
 * Scores and ranks recommendations, considering Bangladesh streaming availability,
 * ratings, popularity, and user preferences. Excludes titles already in library.
 */
export function scoreRecommendations(
  candidates: TmdbTitle[],
  profile: UserPreferenceProfile,
  existingLibraryKeys: Set<string>,
  watchRegion = 'BD',
): ScoredRecommendation[] {
  const seen = new Set<string>();
  const scored: ScoredRecommendation[] = [];

  for (const title of candidates) {
    const lowerTitle = title.title.trim().toLowerCase();
    const dedupeKey1 = `${title.mediaType}:${lowerTitle}`;
    const dedupeKey2 = `${title.mediaType}::${lowerTitle}`;
    if (
      existingLibraryKeys.has(dedupeKey1) ||
      existingLibraryKeys.has(dedupeKey2) ||
      existingLibraryKeys.has(lowerTitle) ||
      seen.has(dedupeKey1)
    ) {
      continue;
    }
    seen.add(dedupeKey1);

    // Floor at rating 6.5 unless high popularity
    if (title.voteAverage < 6.5 && title.voteCount < 500) {
      continue;
    }

    let score = title.voteAverage * 10;
    score += Math.min(25, Math.log10(Math.max(1, title.voteCount)) * 6);

    const provider = title.providers?.[0];
    let providerLabel = provider ? String(provider).toUpperCase() : 'STREAMING';
    if (provider === 'netflix') providerLabel = 'Netflix (BD)';
    else if (provider === 'prime') providerLabel = 'Prime Video (BD)';
    else if (provider === 'max') providerLabel = 'Max';

    let matchReason = `TMDB ${title.voteAverage.toFixed(1)} · ${providerLabel}`;

    if (profile.preferredKinds.has(title.mediaType === 'tv' ? 'series' : 'movie')) {
      score += 8;
    }

    if (title.genres && title.genres.some((g) => profile.preferredGenres.has(g))) {
      score += 15;
      matchReason = `${title.genres.filter((g) => profile.preferredGenres.has(g)).join(', ')} · ${providerLabel}`;
    }

    scored.push({
      title,
      score,
      matchReason,
      provider,
      watchRegion,
    });
  }

  return scored.sort((a, b) => b.score - a.score);
}

export interface SmartNotificationAlert {
  id: string;
  eventType: NotifiedEvent['eventType'];
  title: string;
  body: string;
}

export interface SmartNotificationLabels {
  episodeToday: (show: string, ep: string) => string;
  episodeTomorrow: (show: string, ep: string) => string;
  seasonPremiere: (show: string, season: number) => string;
  movieToday: (title: string) => string;
  movieTomorrow: (title: string) => string;
  dateChanged: (title: string, oldDate: string, newDate: string) => string;
  topRecommendation: (title: string, provider: string, rating: string) => string;
}

/**
 * Generates deduplicated smart notifications for upcoming episodes,
 * season premieres, movie releases, date changes, and top recommendations.
 */
export function mintSmartAlerts(options: {
  episodes: TmdbEpisodeAir[];
  movies: TmdbTitle[];
  recommendations?: ScoredRecommendation[];
  dateChanges?: ReleaseDateChange[];
  todayIso: string;
  alreadyNotifiedIds: Set<string>;
  labels: SmartNotificationLabels;
}): SmartNotificationAlert[] {
  const {
    episodes,
    movies,
    recommendations = [],
    dateChanges = [],
    todayIso,
    alreadyNotifiedIds,
    labels,
  } = options;

  const alerts: SmartNotificationAlert[] = [];

  // 1. Release date change alerts (high priority)
  for (const change of dateChanges) {
    const alertId = `changed:${change.tmdbId}:${change.newReleaseDate}`;
    if (!alreadyNotifiedIds.has(alertId)) {
      alerts.push({
        id: alertId,
        eventType: 'release_date_change',
        title: change.title,
        body: labels.dateChanged(change.title, change.oldReleaseDate ?? 'TBA', change.newReleaseDate),
      });
      alreadyNotifiedIds.add(alertId);
    }
  }

  // 2. Episode releases (today or tomorrow)
  for (const ep of episodes) {
    const diff = daysUntil(todayIso, ep.airDate);
    if (diff === 0 || diff === 1) {
      const epLabel = `S${ep.season} E${ep.episode}`;
      const alertId = `s${ep.showId}:S${ep.season}E${ep.episode}`;
      if (!alreadyNotifiedIds.has(alertId)) {
        const isSeasonPremiere = ep.episode === 1;
        const body = isSeasonPremiere
          ? labels.seasonPremiere(ep.showTitle, ep.season)
          : diff === 0
            ? labels.episodeToday(ep.showTitle, epLabel)
            : labels.episodeTomorrow(ep.showTitle, epLabel);

        alerts.push({
          id: alertId,
          eventType: isSeasonPremiere ? 'season_premiere' : 'episode_air',
          title: ep.showTitle,
          body,
        });
        alreadyNotifiedIds.add(alertId);
      }
    }
  }

  // 3. Movie releases (today or tomorrow)
  for (const movie of movies) {
    if (!movie.releaseDate) continue;
    const diff = daysUntil(todayIso, movie.releaseDate);
    if (diff === 0 || diff === 1) {
      const alertId = `m${movie.tmdbId}:${movie.releaseDate}`;
      if (!alreadyNotifiedIds.has(alertId)) {
        alerts.push({
          id: alertId,
          eventType: 'release_date_change',
          title: movie.title,
          body: diff === 0 ? labels.movieToday(movie.title) : labels.movieTomorrow(movie.title),
        });
        alreadyNotifiedIds.add(alertId);
      }
    }
  }

  // 4. Top highly-rated recommendations (score >= 95, limit 2)
  for (const rec of recommendations.slice(0, 2)) {
    if (rec.title.voteAverage >= 8.2 && rec.title.voteCount >= 200) {
      const alertId = `rec:${rec.title.tmdbId}`;
      if (!alreadyNotifiedIds.has(alertId)) {
        const providerName = rec.provider ? rec.provider.toUpperCase() : 'Streaming';
        alerts.push({
          id: alertId,
          eventType: 'recommendation',
          title: rec.title.title,
          body: labels.topRecommendation(
            rec.title.title,
            providerName,
            rec.title.voteAverage.toFixed(1),
          ),
        });
        alreadyNotifiedIds.add(alertId);
      }
    }
  }

  return alerts;
}

/**
 * Maps TMDB titles and episodes into database rows for SQLite storage.
 */
export function toMediaRows(
  titles: TmdbTitle[],
  category: CachedMediaItem['category'],
  syncedAtIso: string,
  watchRegion = 'BD',
): CachedMediaItem[] {
  return titles.map((t) => ({
    id: `tmdb:${t.mediaType}:${t.tmdbId}`,
    tmdbId: t.tmdbId,
    mediaType: t.mediaType,
    title: t.title,
    overview: t.overview,
    releaseDate: t.releaseDate,
    voteAverage: t.voteAverage,
    voteCount: t.voteCount,
    genres: t.genres ?? [],
    providers: t.providers ?? [],
    watchRegion,
    isMarvel: t.isMarvel === true,
    phase: t.phase ?? (t.isMarvel ? 'Multiverse Saga' : null),
    category,
    lastSyncedAt: syncedAtIso,
  }));
}

export function toEpisodeRows(
  episodes: TmdbEpisodeAir[],
  syncedAtIso: string,
  isMarvel = false,
): CachedEpisodeItem[] {
  return episodes.map((ep) => ({
    id: `ep:${ep.showId}:s${ep.season}e${ep.episode}`,
    showTmdbId: ep.showId,
    showTitle: ep.showTitle,
    seasonNumber: ep.season,
    episodeNumber: ep.episode,
    name: ep.episodeName || `Episode ${ep.episode}`,
    airDate: ep.airDate,
    overview: ep.overview ?? null,
    isMarvel,
    lastSyncedAt: syncedAtIso,
  }));
}
