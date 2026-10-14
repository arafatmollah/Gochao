import {
  SqliteEntertainmentIntelligenceRepository,
  type CachedEpisodeItem,
  type CachedMediaItem,
} from '@/db/repositories/entertainment-intelligence-repository';
import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

let db: TestDatabase;
let repo: SqliteEntertainmentIntelligenceRepository;

const T0 = '2026-10-14T10:00:00.000Z';

function sampleMedia(overrides: Partial<CachedMediaItem> = {}): CachedMediaItem {
  return {
    id: 'tmdb:movie:100',
    tmdbId: 100,
    mediaType: 'movie',
    title: 'Avengers: Doomsday',
    overview: 'The Avengers return.',
    releaseDate: '2026-12-18',
    voteAverage: 8.5,
    voteCount: 1200,
    genres: ['Action', 'Sci-Fi'],
    providers: ['netflix'],
    watchRegion: 'BD',
    isMarvel: true,
    phase: 'Phase 6',
    category: 'marvel',
    lastSyncedAt: T0,
    ...overrides,
  };
}

function sampleEpisode(overrides: Partial<CachedEpisodeItem> = {}): CachedEpisodeItem {
  return {
    id: 'ep:200:s1e1',
    showTmdbId: 200,
    showTitle: 'Vision Quest',
    seasonNumber: 1,
    episodeNumber: 1,
    name: 'Rebirth',
    airDate: '2026-10-14',
    overview: 'Vision awakens.',
    isMarvel: true,
    lastSyncedAt: T0,
    ...overrides,
  };
}

beforeEach(async () => {
  db = await createMigratedDatabase();
  repo = new SqliteEntertainmentIntelligenceRepository(db);
});

describe('SqliteEntertainmentIntelligenceRepository', () => {
  it('upserts and retrieves media by category and marvel status', async () => {
    const doomsday = sampleMedia();
    const spidey = sampleMedia({
      id: 'tmdb:movie:101',
      tmdbId: 101,
      title: 'Spider-Man 4',
      releaseDate: '2026-07-24',
      category: 'upcoming',
    });
    const stranger = sampleMedia({
      id: 'tmdb:tv:102',
      tmdbId: 102,
      title: 'Stranger Things S5',
      mediaType: 'tv',
      releaseDate: '2026-11-01',
      isMarvel: false,
      phase: null,
      category: 'for_you',
      providers: ['netflix'],
    });

    await repo.upsertMediaBatch([doomsday, spidey, stranger]);

    const marvelSlate = await repo.getMarvelSlate();
    expect(marvelSlate).toHaveLength(2);
    expect(marvelSlate[0].title).toBe('Spider-Man 4'); // Earlier date comes first
    expect(marvelSlate[1].title).toBe('Avengers: Doomsday');

    const forYou = await repo.getMediaByCategory('for_you');
    expect(forYou).toHaveLength(1);
    expect(forYou[0].title).toBe('Stranger Things S5');
    expect(forYou[0].providers).toEqual(['netflix']);
  });

  it('filters upcoming releases strictly after a given date', async () => {
    const itemA = sampleMedia({ id: 'm1', releaseDate: '2026-10-15' });
    const itemB = sampleMedia({ id: 'm2', releaseDate: '2026-10-20' });
    const itemPast = sampleMedia({ id: 'm3', releaseDate: '2026-10-10' });

    await repo.upsertMediaBatch([itemA, itemB, itemPast]);

    const upcoming = await repo.getUpcomingReleases('2026-10-14');
    expect(upcoming.map((u) => u.id)).toEqual(['m1', 'm2']);
  });

  it('upserts and retrieves upcoming and marvel episodes', async () => {
    const ep1 = sampleEpisode();
    const ep2 = sampleEpisode({
      id: 'ep:200:s1e2',
      episodeNumber: 2,
      name: 'Episode Two',
      airDate: '2026-10-21',
    });
    const nonMarvelEp = sampleEpisode({
      id: 'ep:300:s2e1',
      showTmdbId: 300,
      showTitle: 'Severance',
      isMarvel: false,
      airDate: '2026-11-01',
    });

    await repo.upsertEpisodesBatch([ep1, ep2, nonMarvelEp]);

    const marvelEpisodes = await repo.getMarvelEpisodes('2026-10-14');
    expect(marvelEpisodes).toHaveLength(2);
    expect(marvelEpisodes.map((e) => e.name)).toEqual(['Rebirth', 'Episode Two']);

    const allUpcoming = await repo.getUpcomingEpisodes('2026-10-20');
    expect(allUpcoming).toHaveLength(2);
    expect(allUpcoming.map((e) => e.showTitle)).toEqual(['Vision Quest', 'Severance']);
  });

  it('detects release date modifications between incoming and cached data', async () => {
    await repo.upsertMediaBatch([sampleMedia({ tmdbId: 50, releaseDate: '2026-05-01' })]);

    const changes = await repo.detectReleaseDateChanges([
      {
        id: 'tmdb:movie:50',
        tmdbId: 50,
        title: 'Avengers: Doomsday',
        mediaType: 'movie',
        releaseDate: '2026-12-18', // Changed date!
      },
      {
        id: 'tmdb:movie:51',
        tmdbId: 51,
        title: 'New Movie',
        mediaType: 'movie',
        releaseDate: '2026-09-01', // New item, not a date change
      },
    ]);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      mediaId: 'tmdb:movie:50',
      tmdbId: 50,
      title: 'Avengers: Doomsday',
      mediaType: 'movie',
      oldReleaseDate: '2026-05-01',
      newReleaseDate: '2026-12-18',
    });
  });

  it('records notified events and prevents duplicate alert checks', async () => {
    expect(await repo.hasEventBeenNotified('notif-1')).toBe(false);

    await repo.recordNotifiedBatch([
      {
        id: 'notif-1',
        eventType: 'episode_air',
        title: 'Vision Quest',
        body: 'Releases today',
        notifiedAt: T0,
      },
    ]);

    expect(await repo.hasEventBeenNotified('notif-1')).toBe(true);

    // Re-inserting the same id should be cleanly ignored without throwing
    await repo.recordNotifiedBatch([
      {
        id: 'notif-1',
        eventType: 'episode_air',
        title: 'Vision Quest duplicate',
        body: 'Releases today',
        notifiedAt: T0,
      },
    ]);

    const events = await repo.getNotifiedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Vision Quest');
  });
});
