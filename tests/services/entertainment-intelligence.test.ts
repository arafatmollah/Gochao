import {
  buildUserPreferenceProfile,
  mintSmartAlerts,
  scoreRecommendations,
  toEpisodeRows,
  toMediaRows,
} from '@/services/entertainment-intelligence';
import type { TmdbEpisodeAir, TmdbTitle } from '@/services/tmdb';
import type { WatchItem } from '@/types/entertainment';

describe('buildUserPreferenceProfile', () => {
  it('extracts preferred kinds and genres from high-rated watchlist items', () => {
    const items: WatchItem[] = [
      {
        id: '1',
        title: 'Interstellar',
        kind: 'movie',
        status: 'watched',
        url: null,
        rating: 5,
        notes: 'Love sci-fi space movies',
        source: 'user',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
      {
        id: '2',
        title: 'Avengers',
        kind: 'movie',
        status: 'watched',
        url: null,
        rating: 5,
        notes: 'Great marvel superhero action',
        source: 'user',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
      {
        id: '3',
        title: 'Random Show',
        kind: 'series',
        status: 'want_to_watch',
        url: null,
        rating: 2,
        notes: null,
        source: 'user',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
    ];

    const profile = buildUserPreferenceProfile(items);
    expect(profile.preferredKinds.has('movie')).toBe(true);
    expect(profile.preferredGenres.has('Sci-Fi')).toBe(true);
    expect(profile.preferredGenres.has('Action')).toBe(true);
    expect(profile.ratedTitlesCount).toBe(2);
  });
});

describe('scoreRecommendations', () => {
  const titles: TmdbTitle[] = [
    {
      tmdbId: 1,
      mediaType: 'movie',
      title: 'Dune: Part Two',
      overview: 'Epic sci-fi',
      releaseDate: '2024-03-01',
      voteAverage: 8.5,
      voteCount: 4000,
      genres: ['Sci-Fi', 'Adventure'],
      providers: ['netflix'],
    },
    {
      tmdbId: 2,
      mediaType: 'movie',
      title: 'Already Saved Movie',
      overview: 'Exists in user library',
      releaseDate: '2024-01-01',
      voteAverage: 9.0,
      voteCount: 5000,
      genres: ['Drama'],
    },
    {
      tmdbId: 3,
      mediaType: 'tv',
      title: 'Low Rated Show',
      overview: 'Poor reception',
      releaseDate: '2024-01-01',
      voteAverage: 4.2,
      voteCount: 50,
    },
  ];

  it('excludes already saved titles and low-rated titles, scoring preferred genres higher', () => {
    const profile = {
      preferredKinds: new Set<any>(['movie']),
      preferredGenres: new Set(['Sci-Fi']),
      ratedTitlesCount: 5,
    };
    const existingKeys = new Set(['movie::already saved movie']);

    const scored = scoreRecommendations(titles, profile, existingKeys, 'BD');

    expect(scored).toHaveLength(1);
    expect(scored[0].title.title).toBe('Dune: Part Two');
    expect(scored[0].score).toBeGreaterThan(100);
    expect(scored[0].matchReason).toContain('Sci-Fi');
    expect(scored[0].watchRegion).toBe('BD');
  });
});

describe('mintSmartAlerts', () => {
  const episodes: TmdbEpisodeAir[] = [
    {
      showId: 10,
      showTitle: 'Daredevil: Born Again',
      season: 1,
      episode: 1,
      episodeName: 'Pilot',
      airDate: '2026-10-14',
    },
    {
      showId: 10,
      showTitle: 'Daredevil: Born Again',
      season: 1,
      episode: 2,
      episodeName: 'Episode 2',
      airDate: '2026-10-15',
    },
    {
      showId: 10,
      showTitle: 'Daredevil: Born Again',
      season: 1,
      episode: 3,
      episodeName: 'Episode 3',
      airDate: '2026-10-30', // Far in future
    },
  ];

  const movies: TmdbTitle[] = [
    {
      tmdbId: 500,
      mediaType: 'movie',
      title: 'Thunderbolts*',
      overview: 'Marvel teamup',
      releaseDate: '2026-10-14',
      voteAverage: 8.0,
      voteCount: 200,
    },
  ];

  it('generates deduplicated alerts for episodes, season premieres, movies, and date changes', () => {
    const alreadyNotified = new Set<string>();
    const labels = {
      episodeToday: (show: string, ep: string) => `${show} ${ep} today`,
      episodeTomorrow: (show: string, ep: string) => `${show} ${ep} tomorrow`,
      seasonPremiere: (show: string, s: number) => `${show} Season ${s} premiere`,
      movieToday: (t: string) => `${t} today`,
      movieTomorrow: (t: string) => `${t} tomorrow`,
      dateChanged: (t: string, o: string, n: string) => `${t} changed from ${o} to ${n}`,
      topRecommendation: (t: string, p: string, r: string) => `${t} on ${p} (${r})`,
    };

    const alerts = mintSmartAlerts({
      episodes,
      movies,
      recommendations: [],
      dateChanges: [
        {
          mediaId: 'm1',
          tmdbId: 99,
          title: 'Avengers',
          mediaType: 'movie',
          oldReleaseDate: '2026-05-01',
          newReleaseDate: '2026-12-18',
        },
      ],
      todayIso: '2026-10-14',
      alreadyNotifiedIds: alreadyNotified,
      labels,
    });

    expect(alerts).toHaveLength(4);
    // 1 date change
    expect(alerts.find((a) => a.eventType === 'release_date_change' && a.title === 'Avengers')).toBeTruthy();
    // 1 season premiere (S1 E1 today)
    expect(alerts.find((a) => a.eventType === 'season_premiere')).toBeTruthy();
    // 1 episode tomorrow (S1 E2)
    expect(alerts.find((a) => a.eventType === 'episode_air')).toBeTruthy();
    // 1 movie today
    expect(alerts.find((a) => a.title === 'Thunderbolts*')).toBeTruthy();

    // Re-running with the populated alreadyNotified set produces zero alerts
    const nextAlerts = mintSmartAlerts({
      episodes,
      movies,
      recommendations: [],
      dateChanges: [],
      todayIso: '2026-10-14',
      alreadyNotifiedIds: alreadyNotified,
      labels,
    });
    expect(nextAlerts).toHaveLength(0);
  });
});

describe('row mappers', () => {
  it('maps TMDB titles and episodes to cache rows', () => {
    const media = toMediaRows(
      [{ tmdbId: 10, mediaType: 'movie', title: 'X-Men', overview: '', releaseDate: '2027-01-01', voteAverage: 8, voteCount: 100, isMarvel: true }],
      'marvel',
      '2026-10-14T00:00:00.000Z',
    );
    expect(media[0].id).toBe('tmdb:movie:10');
    expect(media[0].isMarvel).toBe(true);

    const episodes = toEpisodeRows(
      [{ showId: 20, showTitle: 'Show', season: 1, episode: 1, episodeName: 'Ep 1', airDate: '2026-10-14' }],
      '2026-10-14T00:00:00.000Z',
      true,
    );
    expect(episodes[0].id).toBe('ep:20:s1e1');
    expect(episodes[0].isMarvel).toBe(true);
  });
});
