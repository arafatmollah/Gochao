import { SqliteNoteRepository } from '@/db/repositories/note-repository';
import type { Note } from '@/types/note';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

let db: TestDatabase;
let repo: SqliteNoteRepository;

const T0 = '2026-10-01T08:00:00.000Z';
const T1 = '2026-10-02T08:00:00.000Z';
const T2 = '2026-10-03T08:00:00.000Z';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Grocery list',
    content: 'Rice, oil, onions',
    categoryId: null,
    isPinned: false,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

beforeEach(async () => {
  db = await createMigratedDatabase();
  repo = new SqliteNoteRepository(db);
});

afterEach(() => {
  db.close();
});

describe('NoteRepository', () => {
  it('stores and reads back a note with its category and tags', async () => {
    await repo.insertCategory({ id: 'cat-1', name: 'Home', createdAt: T0 });
    await repo.insertTag({ id: 'tag-1', name: 'tax', createdAt: T0 });
    await repo.insertTag({ id: 'tag-2', name: 'urgent', createdAt: T0 });
    await repo.insert(makeNote({ id: 'note-1', categoryId: 'cat-1' }));
    await repo.setNoteTags('note-1', ['tag-1', 'tag-2']);

    const loaded = await repo.findById('note-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.title).toBe('Grocery list');
    expect(loaded?.categoryName).toBe('Home');
    expect(loaded?.tags.map((tag) => tag.name)).toEqual(['tax', 'urgent']);
  });

  it('lists pinned notes first, then most recently modified', async () => {
    await repo.insert(makeNote({ id: 'old', updatedAt: T0 }));
    await repo.insert(makeNote({ id: 'new', updatedAt: T2 }));
    await repo.insert(makeNote({ id: 'pinned-old', updatedAt: T0, isPinned: true }));
    await repo.insert(makeNote({ id: 'pinned-new', updatedAt: T1, isPinned: true }));

    const ids = (await repo.list()).map((note) => note.id);
    expect(ids).toEqual(['pinned-new', 'pinned-old', 'new', 'old']);
  });

  it('searches title and content and escapes LIKE wildcards in the term', async () => {
    await repo.insert(makeNote({ id: 'percent-title', title: '100% done', content: '' }));
    await repo.insert(makeNote({ id: 'x-title', title: '100x done', content: '' }));
    await repo.insert(makeNote({ id: 'percent-body', title: 'Deal', content: 'save 50% here' }));

    const byWildcard = await repo.list({ search: '100%' });
    expect(byWildcard.map((note) => note.id)).toEqual(['percent-title']);

    const byBody = await repo.list({ search: 'SAVE 50' });
    expect(byBody.map((note) => note.id)).toEqual(['percent-body']);

    const underscore = await repo.list({ search: '100_' });
    expect(underscore).toHaveLength(0);
  });

  it('filters by category and counts notes', async () => {
    await repo.insertCategory({ id: 'cat-1', name: 'Home', createdAt: T0 });
    await repo.insert(makeNote({ id: 'in-cat', categoryId: 'cat-1' }));
    await repo.insert(makeNote({ id: 'uncat' }));

    const filtered = await repo.list({ categoryId: 'cat-1' });
    expect(filtered.map((note) => note.id)).toEqual(['in-cat']);
    expect(await repo.count()).toBe(2);
  });

  it('toggles pin without touching updated_at', async () => {
    await repo.insert(makeNote({ id: 'note-1', updatedAt: T0 }));

    expect(await repo.setPinned('note-1', true)).toBe(true);
    const pinned = await repo.findById('note-1');
    expect(pinned?.isPinned).toBe(true);
    expect(pinned?.updatedAt).toBe(T0);

    expect(await repo.setPinned('missing', true)).toBe(false);
  });

  it('deletes a note and its tag links but keeps the tag rows', async () => {
    await repo.insertTag({ id: 'tag-1', name: 'tax', createdAt: T0 });
    await repo.insert(makeNote({ id: 'note-1' }));
    await repo.setNoteTags('note-1', ['tag-1']);

    expect(await repo.delete('note-1')).toBe(true);
    expect(await repo.findById('note-1')).toBeNull();
    expect(await repo.tagsForNote('note-1')).toEqual([]);
    expect(await repo.listTags()).toHaveLength(1);
    expect(await repo.delete('note-1')).toBe(false);
  });

  it('detaches a deleted category from its notes without deleting them', async () => {
    await repo.insertCategory({ id: 'cat-1', name: 'Home', createdAt: T0 });
    await repo.insert(makeNote({ id: 'note-1', categoryId: 'cat-1' }));

    expect(await repo.deleteCategory('cat-1')).toBe(true);
    const note = await repo.findById('note-1');
    expect(note).not.toBeNull();
    expect(note?.categoryId).toBeNull();
    expect(note?.categoryName).toBeNull();
  });

  it('refuses to delete a tag still linked to a note', async () => {
    await repo.insertTag({ id: 'tag-1', name: 'tax', createdAt: T0 });
    await repo.insert(makeNote({ id: 'note-1' }));
    await repo.setNoteTags('note-1', ['tag-1']);

    expect(await repo.deleteTagIfUnused('tag-1')).toBe(false);
    await repo.delete('note-1');
    expect(await repo.deleteTagIfUnused('tag-1')).toBe(true);
  });

  it('replaces the tag set of a note', async () => {
    await repo.insertTag({ id: 'tag-1', name: 'tax', createdAt: T0 });
    await repo.insertTag({ id: 'tag-2', name: 'urgent', createdAt: T0 });
    await repo.insert(makeNote({ id: 'note-1' }));

    await repo.setNoteTags('note-1', ['tag-1', 'tag-2']);
    expect((await repo.tagsForNote('note-1')).map((tag) => tag.id)).toEqual(['tag-1', 'tag-2']);

    await repo.setNoteTags('note-1', ['tag-2']);
    expect((await repo.tagsForNote('note-1')).map((tag) => tag.id)).toEqual(['tag-2']);
  });
});
