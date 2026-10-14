/**
 * Minimal TMDB (themoviedb.org) client over plain `fetch` — no extra
 * dependencies. The user pastes a free read-only API key into the app (no
 * backend, no bundled secret); every call takes an injectable fetch so unit
 * tests never touch the network.
 *
 * Coverage used by the recommendations sync:
 * - trending movies + TV of the week (popularity-ranked picks),
 * - top-rated titles currently on Netflix / Max / Prime Video,
 * - all Marvel Studios movies + series with dates (company 420),
 * - per-show next-episode air dates for release alerts.
 */

export const TMDB_API_BASE = 'https://api.themoviedb.org/3';
export const MARVEL_COMPANY_ID = 420;
/** Default watch region set to Bangladesh ('BD'). */
export const TMDB_WATCH_REGION = 'BD';
export const TMDB_PROVIDERS = {
  netflix: 8,
  max: 384,
  prime: 119,
} as const;
export type TmdbProviderKey = keyof typeof TMDB_PROVIDERS;

export const DEFAULT_TMDB_API_KEY =
  process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim() || '';

export const TMDB_GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10765: 'Sci-Fi & Fantasy',
};

export interface TmdbTitle {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  overview: string;
  /** `YYYY-MM-DD` or null when unannounced. */
  releaseDate: string | null;
  voteAverage: number;
  voteCount: number;
  genres?: string[];
  providers?: TmdbProviderKey[];
  posterPath?: string | null;
  isMarvel?: boolean;
  phase?: string | null;
}

export interface TmdbEpisodeAir {
  showId: number;
  showTitle: string;
  season: number;
  episode: number;
  episodeName: string;
  /** `YYYY-MM-DD`. */
  airDate: string;
  overview?: string;
}

export type TmdbFailure = 'network' | 'auth' | 'server';

interface TmdbListItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  poster_path?: string;
}

function toTitle(
  item: TmdbListItem,
  fallbackType: 'movie' | 'tv',
  provider?: TmdbProviderKey,
): TmdbTitle | null {
  const mediaType = item.media_type === 'tv' || item.media_type === 'movie' ? item.media_type : fallbackType;
  const title = (mediaType === 'movie' ? item.title : item.name)?.trim() ?? '';
  if (!item.id || title === '') {
    return null;
  }
  const rawDate = (mediaType === 'movie' ? item.release_date : item.first_air_date) ?? '';
  const genres = Array.isArray(item.genre_ids)
    ? item.genre_ids.map((id) => TMDB_GENRES[id]).filter((name): name is string => Boolean(name))
    : [];
  return {
    tmdbId: item.id,
    mediaType,
    title,
    overview: item.overview ?? '',
    releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null,
    voteAverage: typeof item.vote_average === 'number' ? item.vote_average : 0,
    voteCount: typeof item.vote_count === 'number' ? item.vote_count : 0,
    genres,
    providers: provider ? [provider] : [],
    posterPath: item.poster_path ?? null,
  };
}

async function getJson(
  fetchImpl: typeof fetch,
  apiKey: string,
  path: string,
  params: Record<string, string> = {},
): Promise<{ data: unknown; error?: undefined } | { data?: undefined; error: TmdbFailure }> {
  const query = new URLSearchParams({ api_key: apiKey, ...params }).toString();
  let response: Response;
  try {
    response = await fetchImpl(`${TMDB_API_BASE}${path}?${query}`);
  } catch {
    return { error: 'network' };
  }
  if (response.status === 401) {
    return { error: 'auth' };
  }
  if (!response.ok) {
    return { error: 'server' };
  }
  try {
    return { data: await response.json() };
  } catch {
    return { error: 'server' };
  }
}

function listResults(data: unknown): TmdbListItem[] {
  if (typeof data !== 'object' || data === null) {
    return [];
  }
  const results = (data as { results?: unknown }).results;
  return Array.isArray(results) ? (results as TmdbListItem[]) : [];
}

/** Trending movies + TV of the week, strongest first. */
export async function fetchTrending(
  fetchImpl: typeof fetch,
  apiKey: string,
): Promise<{ titles: TmdbTitle[]; error?: undefined } | { titles?: undefined; error: TmdbFailure }> {
  const result = await getJson(fetchImpl, apiKey, '/trending/all/week');
  if (result.error) {
    return { error: result.error };
  }
  const titles = listResults(result.data)
    .map((item) => toTitle(item, 'movie'))
    .filter((title): title is TmdbTitle => title !== null);
  return { titles };
}

/** Top-rated movies or TV currently streaming on one provider. */
export async function fetchProviderTop(
  fetchImpl: typeof fetch,
  apiKey: string,
  provider: TmdbProviderKey,
  mediaType: 'movie' | 'tv',
  watchRegion: string = TMDB_WATCH_REGION,
): Promise<{ titles: TmdbTitle[]; error?: undefined } | { titles?: undefined; error: TmdbFailure }> {
  const result = await getJson(fetchImpl, apiKey, `/discover/${mediaType}`, {
    with_watch_providers: String(TMDB_PROVIDERS[provider]),
    watch_region: watchRegion,
    'vote_count.gte': '150',
    'vote_average.gte': '7',
    sort_by: 'vote_average.desc',
  });
  if (result.error) {
    return { error: result.error };
  }
  let items = listResults(result.data);
  if (items.length === 0 && watchRegion !== '') {
    const fallback = await getJson(fetchImpl, apiKey, `/discover/${mediaType}`, {
      with_watch_providers: String(TMDB_PROVIDERS[provider]),
      'vote_count.gte': '150',
      'vote_average.gte': '7',
      sort_by: 'vote_average.desc',
    });
    if (!fallback.error) {
      const fallbackItems = listResults(fallback.data);
      if (fallbackItems.length > 0) {
        items = fallbackItems;
      }
    }
  }
  const titles = items
    .map((item) => toTitle(item, mediaType, provider))
    .filter((title): title is TmdbTitle => title !== null);
  return { titles };
}

function companyParams(extra: Record<string, string> = {}): Record<string, string> {
  return { with_companies: String(MARVEL_COMPANY_ID), ...extra };
}

/** Marvel Studios movies releasing on/after `fromDate`, soonest first. */
export async function fetchMarvelMovies(
  fetchImpl: typeof fetch,
  apiKey: string,
  fromDate: string,
): Promise<{ titles: TmdbTitle[]; error?: undefined } | { titles?: undefined; error: TmdbFailure }> {
  const result = await getJson(
    fetchImpl,
    apiKey,
    '/discover/movie',
    companyParams({
      'primary_release_date.gte': fromDate,
      sort_by: 'primary_release_date.asc',
    }),
  );
  if (result.error) {
    return { error: result.error };
  }
  const titles = listResults(result.data)
    .map((item) => {
      const title = toTitle(item, 'movie');
      if (title) {
        title.isMarvel = true;
      }
      return title;
    })
    .filter((title): title is TmdbTitle => title !== null);
  return { titles };
}

/** Marvel Studios series, newest premieres first (for episode tracking). */
export async function fetchMarvelSeries(
  fetchImpl: typeof fetch,
  apiKey: string,
): Promise<{ titles: TmdbTitle[]; error?: undefined } | { titles?: undefined; error: TmdbFailure }> {
  const result = await getJson(
    fetchImpl,
    apiKey,
    '/discover/tv',
    companyParams({ sort_by: 'first_air_date.desc' }),
  );
  if (result.error) {
    return { error: result.error };
  }
  const titles = listResults(result.data)
    .map((item) => {
      const title = toTitle(item, 'tv');
      if (title) {
        title.isMarvel = true;
      }
      return title;
    })
    .filter((title): title is TmdbTitle => title !== null);
  return { titles };
}

/** Next airing episode of one series, or null when finished/unannounced. */
export async function fetchNextEpisode(
  fetchImpl: typeof fetch,
  apiKey: string,
  showId: number,
  showTitle: string,
): Promise<{ episode: TmdbEpisodeAir | null; error?: undefined } | { episode?: undefined; error: TmdbFailure }> {
  const result = await getJson(fetchImpl, apiKey, `/tv/${showId}`);
  if (result.error) {
    return { error: result.error };
  }
  if (typeof result.data !== 'object' || result.data === null) {
    return { episode: null };
  }
  const next = (result.data as { next_episode_to_air?: unknown }).next_episode_to_air;
  if (typeof next !== 'object' || next === null) {
    return { episode: null };
  }
  const record = next as {
    season_number?: unknown;
    episode_number?: unknown;
    name?: unknown;
    air_date?: unknown;
  };
  const airDate = typeof record.air_date === 'string' ? record.air_date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(airDate)) {
    return { episode: null };
  }
  return {
    episode: {
      showId,
      showTitle,
      season: typeof record.season_number === 'number' ? record.season_number : 0,
      episode: typeof record.episode_number === 'number' ? record.episode_number : 0,
      episodeName: typeof record.name === 'string' ? record.name : '',
      airDate,
    },
  };
}
