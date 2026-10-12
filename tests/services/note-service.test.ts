import { SqliteNoteRepository } from '@/db/repositories/note-repository';
import { createNoteService } from '@/services/note-service';
import { NOTE_TITLE_MAX_LENGTH } from '@/types/note';
import { AppError } from '@/utils/errors';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

let db: TestDatabase;
let clock: string;
let idSeq: number;
let service: ReturnType<typeof createNoteService>;

const NOW = '2026-10-12T09:00:00.000Z';
const LATER = '2026-10-12T10:30:00.000Z';

beforeEach(async () => {
  db = await createMigratedDatabase();
  clock = NOW;
  idSeq = 0;
  service = createNoteService(new SqliteNoteRepository(db), {
    now: () => clock,
    generateId: () => `id-${++idSeq}`,
  });
});

afterEach(() => {
  db.close();
});

async function expectAppError(promise: Promise<unknown>, code: string, message?: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((error: AppError) => {
    expect(error.code).toBe(code);
    if (message) {
      expect(error.message).toBe(message);
    }
  });
}

describe('NoteService', () => {
  it('trims input and deduplicates tag names case-insensitively', async () => {
    const note = await service.create({
      title: '  Shopping  ',
      content: '  rice, oil  ',
      tagNames: ['Home', 'home ', '', '  '],
    });

    expect(note.title).toBe('Shopping');
    expect(note.content).toBe('rice, oil');

    const stored = await service.getById(note.id);
    expect(stored.tags).toHaveLength(1);
    expect(stored.tags[0].name).toBe('Home');
  });

  it('rejects an empty note and an over-long title', async () => {
    await expectAppError(service.create({ title: '   ', content: '  ' }), 'validation', 'note_empty');
    await expectAppError(
      service.create({ title: 'x'.repeat(NOTE_TITLE_MAX_LENGTH + 1), content: '' }),
      'validation',
      'note_title_too_long',
    );
  });

  it('rejects a category that does not exist', async () => {
    await expectAppError(
      service.create({ title: 'Note', content: '', categoryId: 'ghost' }),
      'validation',
      'note_category_unavailable',
    );
  });

  it('updates content, bumps updated_at, and keeps created_at', async () => {
    const note = await service.create({ title: 'Draft', content: 'v1' });
    expect(note.createdAt).toBe(NOW);

    clock = LATER;
    const updated = await service.update(note.id, { content: 'v2' });
    expect(updated.content).toBe('v2');
    expect(updated.title).toBe('Draft');
    expect(updated.createdAt).toBe(NOW);
    expect(updated.updatedAt).toBe(LATER);
  });

  it('replaces the tag set only when tagNames are provided', async () => {
    const note = await service.create({ title: 'Tagged', content: '', tagNames: ['alpha'] });
    expect((await service.getById(note.id)).tags.map((tag) => tag.name)).toEqual(['alpha']);

    await service.update(note.id, { title: 'Tagged 2' });
    expect((await service.getById(note.id)).tags.map((tag) => tag.name)).toEqual(['alpha']);

    await service.update(note.id, { tagNames: ['beta'] });
    const tags = (await service.getById(note.id)).tags.map((tag) => tag.name);
    expect(tags).toEqual(['beta']);
  });

  it('throws not_found when pinning or deleting a missing note', async () => {
    await expectAppError(service.setPinned('ghost', true), 'not_found');
    await expectAppError(service.remove('ghost'), 'not_found');
  });

  it('pins a note without changing updated_at', async () => {
    const note = await service.create({ title: 'Pin me', content: '' });
    clock = LATER;
    await service.setPinned(note.id, true);
    const stored = await service.getById(note.id);
    expect(stored.isPinned).toBe(true);
    expect(stored.updatedAt).toBe(NOW);
  });

  it('rejects duplicate category names case-insensitively', async () => {
    await service.createCategory('Home');
    await expectAppError(service.createCategory('home'), 'conflict', 'note_category_name_taken');
  });

  it('keeps notes when their category is deleted', async () => {
    const category = await service.createCategory('Home');
    const note = await service.create({ title: 'Note', content: '', categoryId: category.id });

    await service.removeCategory(category.id);

    const stored = await service.getById(note.id);
    expect(stored.categoryId).toBeNull();
    expect(stored.title).toBe('Note');
  });
});
