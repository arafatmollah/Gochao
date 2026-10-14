import {
  daysUntil,
  pickEpisodeAlerts,
  pickMovieAlerts,
  pickRecommendations,
  runEntertainmentSync,
  type SyncLabels,
} from '@/services/entertainment-sync';

const labels: SyncLabels = {
  episodeToday: (show, episode) => `${show} ${episode} today`,
  episodeTomorrow: (show, episode) => `${show} ${episode} tomorrow`,
  episodeDate: (show, episode, date) => `${show} ${episode} ${date}`,
  movieOutNow: (title) => `${title} out`,
  movieToday: (title) => `${title} today`,
  movieDate: (title, date) => `${title} ${date}`,
  recNotes: (vote, source) => `TMDB ${vote} · ${source}`,
};

describe('daysUntil', () => {
  it('counts whole days between ISO dates', () => {
    expect(daysUntil('2026-10-13', '2026-10-13')).toBe(0);
    expect(daysUntil('2026-10-13', '2026-10-14')).toBe(1);
    expect(daysUntil('2026-10-13', '2026-10-06')).toBe(-7);
  });
});

describe('pickEpisodeAlerts', () => {
  const episodes = [
    { showId: 1, showTitle: 'Vision Quest', season: 1, episode: 2, episodeName: '', airDate: '2026-10-14' },
    { showId: 2, showTitle: 'X-Men', season: 2, episode: 1, episodeName: '', airDate: '2026-10-13' },
    { showId: 3, showTitle: 'Old Show', season: 1, episode: 1, episodeName: '', airDate: '2026-09-01' },
    { showId: 4, showTitle: 'Far Show', season: 1, episode: 1, episodeName: '', airDate: '2027-03-01' },
  ];

  it('alerts for today and tomorrow first, skipping notified and out-of-range', () => {
    const alerts = pickEpisodeAlerts(episodes, '2026-10-13', ['s1:S1E2'], labels);

    expect(alerts.map((alert) => alert.key)).toEqual(['s2:S2E1']);
    expect(alerts[0].body).toContain('today');
  });

  it('covers this-week airings with dates', () => {
    const alerts = pickEpisodeAlerts(episodes, '2026-10-13', [], labels);

    expect(alerts.map((alert) => alert.key)).toEqual(['s2:S2E1', 's1:S1E2']);
  });
});

describe('pickMovieAlerts', () => {
  const movies = [
    { tmdbId: 1, mediaType: 'movie', title: 'New Hit', overview: '', releaseDate: '2026-10-13', voteAverage: 0, voteCount: 0 },
    { tmdbId: 2, mediaType: 'movie', title: 'Soon', overview: '', releaseDate: '2026-11-01', voteAverage: 0, voteCount: 0 },
    { tmdbId: 3, mediaType: 'movie', title: 'Old', overview: '', releaseDate: '2026-01-01', voteAverage: 0, voteCount: 0 },
  ] as const;

  it('alerts for today and dated releases, skipping old and notified', () => {
    const alerts = pickMovieAlerts([...movies], '2026-10-13', [], labels);

    expect(alerts.map((alert) => alert.key)).toEqual(['m1:2026-10-13', 'm2:2026-11-01']);
    expect(alerts[0].body).toContain('today');
  });
});

describe('pickRecommendations', () => {
  it('ranks by rating with vote floors, dedupes, and caps', () => {
    const picks = pickRecommendations(
      [
        {
          label: 'Trending',
          titles: [
            { tmdbId: 1, mediaType: 'movie', title: 'Gem', overview: '', releaseDate: null, voteAverage: 8.5, voteCount: 500 },
            { tmdbId: 2, mediaType: 'movie', title: 'Flop', overview: '', releaseDate: null, voteAverage: 5.0, voteCount: 9999 },
            { tmdbId: 3, mediaType: 'movie', title: 'Obscure', overview: '', releaseDate: null, voteAverage: 9.0, voteCount: 10 },
          ],
        },
        {
          label: 'Top on Netflix',
          titles: [
            { tmdbId: 4, mediaType: 'tv', title: 'Gem', overview: '', releaseDate: null, voteAverage: 8.0, voteCount: 400 },
          ],
        },
      ],
      labels,
      5,
    );

    // 'Gem' twice (movie + tv are distinct kinds), flop/obscure filtered out.
    expect(picks).toEqual([
      { title: 'Gem', kind: 'movie', notes: 'TMDB 8.5 · Trending' },
      { title: 'Gem', kind: 'series', notes: 'TMDB 8.0 · Top on Netflix' },
    ]);
  });
});

describe('runEntertainmentSync', () => {
  function stubFetch(routes: Record<string, unknown>): typeof fetch {
    return (async (url: string) => {
      const path = new URL(url).pathname;
      for (const [route, payload] of Object.entries(routes)) {
        if (path.endsWith(route)) {
          return new Response(JSON.stringify(payload), { status: 200 });
        }
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }) as typeof fetch;
  }

  it('alerts, saves picks with tmdb source, and builds the feed', async () => {
    const saved: { title: string; kind: string; source?: string; notes?: string }[] = [];
    const notified: string[] = [];
    const service = {
      saveSpotlight: async (title: string, kind: 'movie' | 'series', extra?: { source?: 'user' | 'tmdb'; notes?: string }) => {
        saved.push({ title, kind, ...extra });
        return { item: null as never, created: true };
      },
    };
    const fetchImpl = stubFetch({
      '/trending/all/week': {
        results: [{ id: 100, media_type: 'movie', title: 'Trending Gem', vote_average: 8.2, vote_count: 800 }],
      },
      '/discover/movie': {
        results: [{ id: 200, title: 'Marvel Movie', release_date: '2026-10-13', vote_average: 0, vote_count: 0 }],
      },
      '/discover/tv': {
        results: [{ id: 300, name: 'Vision Quest', first_air_date: '2026-01-01', vote_average: 0, vote_count: 0 }],
      },
      '/tv/300': {
        next_episode_to_air: { season_number: 1, episode_number: 2, name: '', air_date: '2026-10-13' },
      },
    });

    const result = await runEntertainmentSync({
      fetchImpl,
      apiKey: 'key',
      todayIso: '2026-10-13',
      notifiedKeys: [],
      labels,
      trendingLabel: 'Trending',
      providerLabels: { netflix: 'Netflix', max: 'Max', prime: 'Prime' },
      services: {
        entertainment: service as never,
        notify: async (title, body) => {
          notified.push(`${title} :: ${body}`);
        },
      },
    });

    expect(result.error).toBeUndefined();
    // Episode today + movie today.
    expect(result.alerts.map((alert) => alert.key)).toEqual(['s300:S1E2', 'm200:2026-10-13']);
    expect(result.notifiedKeys).toEqual(['s300:S1E2', 'm200:2026-10-13']);
    expect(notified).toHaveLength(2);
    // Trending Gem saved once with tmdb source.
    expect(saved).toEqual([
      { title: 'Trending Gem', kind: 'movie', source: 'tmdb', notes: 'TMDB 8.2 · Trending' },
    ]);
    expect(result.added).toBe(1);
    expect(result.trending.map((entry) => entry.title)).toContain('Trending Gem');
    expect(result.marvel.map((entry) => entry.title)).toContain('Vision Quest');
  });

  it('skips already-notified episodes and already-saved titles', async () => {
    const saved: unknown[] = [];
    const service = {
      saveSpotlight: async () => {
        saved.push(1);
        return { item: null as never, created: false };
      },
    };
    const fetchImpl = stubFetch({
      '/tv/300': {
        next_episode_to_air: { season_number: 1, episode_number: 2, name: '', air_date: '2026-10-13' },
      },
      '/discover/tv': {
        results: [{ id: 300, name: 'Vision Quest', first_air_date: '2026-01-01' }],
      },
    });

    const result = await runEntertainmentSync({
      fetchImpl,
      apiKey: 'key',
      todayIso: '2026-10-13',
      notifiedKeys: ['s300:S1E2'],
      labels,
      trendingLabel: 'Trending',
      providerLabels: { netflix: 'Netflix', max: 'Max', prime: 'Prime' },
      services: { entertainment: service as never, notify: async () => {} },
    });

    expect(result.alerts).toEqual([]);
    expect(result.notifiedKeys).toEqual([]);
  });

  it('reports auth failures without throwing', async () => {
    const denied = ((_url: string) => Promise.resolve(new Response('{}', { status: 401 }))) as typeof fetch;
    const result = await runEntertainmentSync({
      fetchImpl: denied,
      apiKey: 'bad',
      todayIso: '2026-10-13',
      notifiedKeys: [],
      labels,
      trendingLabel: 'Trending',
      providerLabels: { netflix: 'Netflix', max: 'Max', prime: 'Prime' },
      services: {
        entertainment: { saveSpotlight: async () => ({ item: null as never, created: false }) } as never,
        notify: async () => {},
      },
    });

    expect(result.error).toBe('auth');
    expect(result.added).toBe(0);
    expect(result.alerts).toEqual([]);
  });
});
