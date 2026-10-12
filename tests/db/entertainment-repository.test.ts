import { SqliteWatchlistRepository } from '@/db/repositories/entertainment-repository';
import type { WatchItem } from '@/types/entertainment';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

let db: TestDatabase;
let repo: SqliteWatchlistRepository;

const T0 = '2026-10-01T08:00:00.000Z';

function makeItem(overrides: Partial<WatchItem> = {}): WatchItem {
  return {
    id: 'watch-1',
    title: 'Dune: Part Three',
    kind: 'movie',
    status: 'want_to_watch',
    url: null,
    rating: null,
    notes: null,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

beforeEach(async () => {
  db = await createMigratedDatabase();
  repo = new SqliteWatchlistRepository(db);
});

afterEach(() => {
  db.close();
});

describe('WatchlistRepository', () => {
  it('stores and reads back an item', async () => {
    await repo.insert(makeItem({ url: 'https://youtu.be/abc', rating: 5, notes: 'Must watch' }));

    const loaded = await repo.findById('watch-1');
    expect(loaded).toEqual(makeItem({ url: 'https://youtu.be/abc', rating: 5, notes: 'Must watch' }));
    expect(await repo.findById('missing')).toBeNull();
  });

  it('orders watching first, then want-to-watch, then watched', async () => {
    await repo.insert(makeItem({ id: 'watched', status: 'watched', updatedAt: T0 }));
    await repo.insert(makeItem({ id: 'want', status: 'want_to_watch', updatedAt: T0 }));
    await repo.insert(makeItem({ id: 'watching', status: 'watching', updatedAt: T0 }));

    expect((await repo.list({})).map((item) => item.id)).toEqual([
      'watching',
      'want',
      'watched',
    ]);
  });

  it('filters by status, kind, and title search', async () => {
    await repo.insert(makeItem({ id: 'a', title: 'Dune: Part Three', kind: 'movie' }));
    await repo.insert(makeItem({ id: 'b', title: 'Dune', kind: 'series', status: 'watched' }));
    await repo.insert(
      makeItem({ id: 'c', title: '100% concert', kind: 'video', status: 'watching' }),
    );

    expect((await repo.list({ status: 'watched' })).map((i) => i.id)).toEqual(['b']);
    expect((await repo.list({ kind: 'video' })).map((i) => i.id)).toEqual(['c']);
    expect((await repo.list({ search: 'dune' })).map((i) => i.id)).toEqual(['a', 'b']);
    expect((await repo.list({ search: '100%' })).map((i) => i.id)).toEqual(['c']);
  });

  it('finds titles case-insensitively for the spotlight check', async () => {
    await repo.insert(makeItem({ title: 'Dune: Part Three', kind: 'movie' }));

    expect((await repo.findByTitle('dune: part three', 'movie'))?.id).toBe('watch-1');
    expect(await repo.findByTitle('dune: part three', 'series')).toBeNull();
    expect((await repo.findByTitle('  DUNE: PART THREE  ', 'movie'))?.id).toBe('watch-1');
  });

  it('updates and deletes items', async () => {
    await repo.insert(makeItem());
    await repo.update({ ...makeItem(), status: 'watched', rating: 4 });
    expect((await repo.findById('watch-1'))?.status).toBe('watched');

    expect(await repo.delete('watch-1')).toBe(true);
    expect(await repo.findById('watch-1')).toBeNull();
    expect(await repo.delete('watch-1')).toBe(false);
  });

  it('enforces rating bounds and non-empty titles', async () => {
    await expect(repo.insert(makeItem({ id: 'r6', rating: 6 }))).rejects.toThrow();
    await expect(repo.insert(makeItem({ id: 'blank', title: '   ' }))).rejects.toThrow();
  });
});
