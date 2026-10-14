import {
  fetchMarvelMovies,
  fetchMarvelSeries,
  fetchNextEpisode,
  fetchProviderTop,
  fetchTrending,
} from '@/services/tmdb';

function stubFetch(payload: unknown, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify(payload), { status })) as typeof fetch;
}

describe('tmdb client', () => {
  it('parses trending movies and tv', async () => {
    const result = await fetchTrending(
      stubFetch({
        results: [
          { id: 1, media_type: 'movie', title: 'Dune', vote_average: 8.1, vote_count: 500 },
          { id: 2, media_type: 'tv', name: 'Severance', vote_average: 8.7, vote_count: 900 },
          { id: 3, media_type: 'person', name: 'Someone' },
          { id: 0, media_type: 'movie', title: '' },
        ],
      }),
      'key',
    );

    expect(result.error).toBeUndefined();
    if (!result.titles) {
      throw new Error('expected titles');
    }
    expect(result.titles.map((title) => title.title)).toEqual(['Dune', 'Severance']);
    expect(result.titles[1]).toMatchObject({ mediaType: 'tv', tmdbId: 2 });
  });

  it('maps invalid API keys to auth', async () => {
    const result = await fetchTrending(stubFetch({}, 401), 'bad');
    expect(result).toEqual({ error: 'auth' });
  });

  it('fetches provider tops and marvel movies', async () => {
    const movies = await fetchProviderTop(
      stubFetch({ results: [{ id: 9, title: 'Top Gun', vote_average: 8.0, vote_count: 300 }] }),
      'key',
      'netflix',
      'movie',
    );
    expect(movies.titles?.[0]).toMatchObject({ title: 'Top Gun', mediaType: 'movie' });

    const marvel = await fetchMarvelMovies(
      stubFetch({
        results: [{ id: 10, title: 'Avengers', release_date: '2026-12-18', vote_average: 0, vote_count: 0 }],
      }),
      'key',
      '2026-10-13',
    );
    expect(marvel.titles?.[0]).toMatchObject({ title: 'Avengers', releaseDate: '2026-12-18' });

    const series = await fetchMarvelSeries(
      stubFetch({ results: [{ id: 11, name: 'Vision Quest', first_air_date: '2026-01-01' }] }),
      'key',
    );
    expect(series.titles?.[0]).toMatchObject({ title: 'Vision Quest', mediaType: 'tv' });
  });

  it('reads next-episode air dates', async () => {
    const result = await fetchNextEpisode(
      stubFetch({
        next_episode_to_air: {
          season_number: 1,
          episode_number: 2,
          name: 'Double Feature',
          air_date: '2026-10-14',
        },
      }),
      'key',
      11,
      'Vision Quest',
    );

    expect(result.episode).toEqual({
      showId: 11,
      showTitle: 'Vision Quest',
      season: 1,
      episode: 2,
      episodeName: 'Double Feature',
      airDate: '2026-10-14',
    });
  });

  it('returns null when a show is finished or undated', async () => {
    expect((await fetchNextEpisode(stubFetch({}), 'key', 1, 'Done')).episode).toBeNull();
    expect(
      (
        await fetchNextEpisode(
          stubFetch({ next_episode_to_air: { season_number: 1, air_date: 'soon' } }),
          'key',
          1,
          'TBA',
        )
      ).episode,
    ).toBeNull();
  });
});
