import { SqliteWatchlistRepository } from '@/db/repositories/entertainment-repository';
import {
  createEntertainmentService,
  type EntertainmentService,
} from '@/services/entertainment-service';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

/** Deterministic clock: each call returns the next timestamp in a fixed sequence. */
function createTickClock(startSeconds = 0): () => string {
  let tick = startSeconds;
  return () => {
    const iso = `2026-10-11T08:00:${String(tick).padStart(2, '0')}.000Z`;
    tick += 1;
    return iso;
  };
}

describe('EntertainmentService', () => {
  let db: TestDatabase;
  let service: EntertainmentService;
  let nextId: number;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    nextId = 0;
    service = createEntertainmentService(new SqliteWatchlistRepository(db), {
      now: createTickClock(),
      generateId: () => `generated-${++nextId}`,
    });
  });

  afterEach(() => {
    db.close();
  });

  it('creates an item with trimmed fields and defaults', async () => {
    const item = await service.create({ title: '  Dune: Part Three  ' });

    expect(item.title).toBe('Dune: Part Three');
    expect(item.kind).toBe('movie');
    expect(item.status).toBe('want_to_watch');
    expect(item.url).toBeNull();
    expect(item.rating).toBeNull();
    expect(item.id).toBe('generated-1');
  });

  it('rejects blank titles, bad links, and bad ratings without writing', async () => {
    await expect(service.create({ title: '   ' })).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(service.create({ title: 'X', url: 'not a link' })).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(service.create({ title: 'X', url: 'ftp://files/x' })).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(service.create({ title: 'X', rating: 0 })).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(service.create({ title: 'X', rating: 6 })).rejects.toMatchObject({
      code: 'validation',
    });
    expect(await service.list({})).toHaveLength(0);
  });

  it('accepts links and ratings, then updates, rates, and moves status', async () => {
    const item = await service.create({
      title: 'Video essay',
      kind: 'video',
      url: 'https://www.youtube.com/watch?v=abc',
      rating: 5,
    });
    expect(item.url).toBe('https://www.youtube.com/watch?v=abc');

    const watching = await service.setStatus(item.id, 'watching');
    expect(watching.status).toBe('watching');
    expect(await service.setStatus(item.id, 'watching')).toEqual(watching);

    const unrated = await service.setRating(item.id, null);
    expect(unrated.rating).toBeNull();
    await expect(service.setRating(item.id, 9)).rejects.toMatchObject({ code: 'validation' });

    const renamed = await service.update(item.id, { title: 'Essay v2' });
    expect(renamed.title).toBe('Essay v2');

    await service.remove(item.id);
    await expect(service.getById(item.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(service.remove(item.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('saves spotlight entries once, returning the existing row after', async () => {
    const first = await service.saveSpotlight('Avengers: Doomsday', 'movie');
    expect(first.created).toBe(true);

    const second = await service.saveSpotlight('avengers: doomsday', 'movie');
    expect(second.created).toBe(false);
    expect(second.item.id).toBe(first.item.id);

    // Same title as a different kind is a different row.
    const series = await service.saveSpotlight('Avengers: Doomsday', 'series');
    expect(series.created).toBe(true);

    expect(await service.list({})).toHaveLength(2);
  });
});
