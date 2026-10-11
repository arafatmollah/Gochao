import { SqliteTaskRepository } from '@/db/repositories/task-repository';

import { makeTask } from '../helpers/factories';
import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

describe('SqliteTaskRepository', () => {
  let db: TestDatabase;
  let repo: SqliteTaskRepository;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    repo = new SqliteTaskRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('inserts and reads back a task with all fields preserved (roundtrip)', async () => {
    const task = makeTask({
      id: 't-1',
      title: 'Buy groceries',
      description: 'Rice, lentils, oil',
      dueAt: '2026-10-15',
      priority: 'high',
      parentTaskId: null,
    });
    await repo.insert(task);

    const loaded = await repo.findById('t-1');
    expect(loaded).toEqual(task);
  });

  it('returns null for a missing task', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('updates an existing task', async () => {
    await repo.insert(makeTask({ id: 't-1', title: 'Old' }));

    const updated = makeTask({
      id: 't-1',
      title: 'New',
      priority: 'low',
      updatedAt: '2026-10-12T00:00:00.000Z',
    });
    await repo.update(updated);

    expect(await repo.findById('t-1')).toEqual(updated);
  });

  it('deletes a task and reports whether a row was removed', async () => {
    await repo.insert(makeTask({ id: 't-1' }));

    expect(await repo.delete('t-1')).toBe(true);
    expect(await repo.delete('t-1')).toBe(false);
    expect(await repo.findById('t-1')).toBeNull();
  });

  describe('listing', () => {
    beforeEach(async () => {
      await repo.insert(makeTask({ id: 'p-11-med', dueAt: '2026-10-11', priority: 'medium' }));
      await repo.insert(makeTask({ id: 'p-12-low', dueAt: '2026-10-12', priority: 'low' }));
      await repo.insert(makeTask({ id: 'p-12-high', dueAt: '2026-10-12', priority: 'high' }));
      await repo.insert(makeTask({ id: 'p-nodate-high', dueAt: null, priority: 'high' }));
      await repo.insert(
        makeTask({
          id: 'c-1',
          status: 'completed',
          completedAt: '2026-10-10T09:00:00.000Z',
        }),
      );
    });

    it('orders pending tasks by due date, then priority, with no-due-date last', async () => {
      const rows = await repo.list({ status: 'pending' });
      expect(rows.map((t) => t.id)).toEqual([
        'p-11-med',
        'p-12-high',
        'p-12-low',
        'p-nodate-high',
      ]);
    });

    it('orders completed tasks by completion time, most recent first', async () => {
      await repo.insert(
        makeTask({
          id: 'c-2',
          status: 'completed',
          completedAt: '2026-10-11T09:00:00.000Z',
        }),
      );
      const rows = await repo.list({ status: 'completed' });
      expect(rows.map((t) => t.id)).toEqual(['c-2', 'c-1']);
    });

    it('filters by priority', async () => {
      const rows = await repo.list({ priority: 'high' });
      expect(rows.map((t) => t.id).sort()).toEqual(['p-12-high', 'p-nodate-high']);
    });

    it('searches title and description case-insensitively', async () => {
      await repo.insert(
        makeTask({ id: 'search-1', title: 'PAY electric bill', description: 'Due to DESCO' }),
      );

      expect((await repo.list({ search: 'electric' })).map((t) => t.id)).toEqual(['search-1']);
      expect((await repo.list({ search: 'desco' })).map((t) => t.id)).toEqual(['search-1']);
      expect(await repo.list({ search: 'nonexistent-term' })).toEqual([]);
    });

    it('treats LIKE wildcards in the search term literally', async () => {
      await repo.insert(makeTask({ id: 'pct', title: 'Save 50% on rent' }));
      await repo.insert(makeTask({ id: 'no-pct', title: 'Save 5000 taka on rent' }));

      const percentRows = await repo.list({ search: '50%' });
      expect(percentRows.map((t) => t.id)).toEqual(['pct']);

      await repo.insert(makeTask({ id: 'under', title: 'a_b' }));
      await repo.insert(makeTask({ id: 'any', title: 'aXb' }));
      const underscoreRows = await repo.list({ search: 'a_b' });
      expect(underscoreRows.map((t) => t.id)).toEqual(['under']);
    });

    it('applies limit and offset for pagination', async () => {
      const firstPage = await repo.list({ status: 'pending', limit: 2, offset: 0 });
      const secondPage = await repo.list({ status: 'pending', limit: 2, offset: 2 });

      expect(firstPage.map((t) => t.id)).toEqual(['p-11-med', 'p-12-high']);
      expect(secondPage.map((t) => t.id)).toEqual(['p-12-low', 'p-nodate-high']);
    });

    it('lists tasks of all statuses with pending first', async () => {
      const rows = await repo.list({});
      const ids = rows.map((t) => t.id);
      expect(ids.indexOf('c-1')).toBeGreaterThan(ids.indexOf('p-nodate-high'));
    });
  });

  describe('database constraints', () => {
    it('rejects an empty title', async () => {
      await expect(repo.insert(makeTask({ title: '   ' }))).rejects.toThrow();
    });

    it('rejects an invalid due date format', async () => {
      await expect(repo.insert(makeTask({ dueAt: '11/10/2026' }))).rejects.toThrow();
    });

    it('rejects an invalid priority', async () => {
      await expect(
        repo.insert(makeTask({ priority: 'urgent' as never })),
      ).rejects.toThrow();
    });

    it('enforces the completion invariant (completed implies completed_at)', async () => {
      await repo.insert(makeTask({ id: 'x', status: 'pending' }));

      await expect(
        db.runAsync(`UPDATE tasks SET status = 'completed' WHERE id = ?`, ['x']),
      ).rejects.toThrow();

      await expect(
        db.runAsync(`UPDATE tasks SET completed_at = ? WHERE id = ?`, [
          '2026-10-11T00:00:00.000Z',
          'x',
        ]),
      ).rejects.toThrow();
    });

    it('enforces the parent task foreign key with ON DELETE SET NULL', async () => {
      await repo.insert(makeTask({ id: 'parent' }));
      await repo.insert(makeTask({ id: 'child', parentTaskId: 'parent' }));

      await expect(
        repo.insert(makeTask({ id: 'orphan', parentTaskId: 'missing-parent' })),
      ).rejects.toThrow();

      await repo.delete('parent');

      const child = await repo.findById('child');
      expect(child?.parentTaskId).toBeNull();
    });
  });
});
