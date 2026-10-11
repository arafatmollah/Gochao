import { SqliteTaskRepository, type TaskRepository } from '@/db/repositories/task-repository';
import { createTaskService, type TaskService } from '@/services/task-service';
import { AppError } from '@/utils/errors';

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

describe('TaskService', () => {
  let db: TestDatabase;
  let repo: SqliteTaskRepository;
  let service: TaskService;
  let nextId: number;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    repo = new SqliteTaskRepository(db);
    nextId = 0;
    service = createTaskService(repo, {
      now: createTickClock(),
      generateId: () => `generated-${++nextId}`,
    });
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('trims the title and applies defaults (pending, medium priority, timestamps)', async () => {
      const task = await service.create({ title: '  Call mother  ' });

      expect(task.title).toBe('Call mother');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('medium');
      expect(task.completedAt).toBeNull();
      expect(task.id).toBe('generated-1');
      expect(task.createdAt).toBe(task.updatedAt);

      expect(await repo.findById(task.id)).toEqual(task);
    });

    it('normalizes an empty description to null', async () => {
      const task = await service.create({ title: 'Task', description: '   ' });
      expect(task.description).toBeNull();
    });

    it('rejects an empty or whitespace-only title without writing a row', async () => {
      await expect(service.create({ title: '   ' })).rejects.toMatchObject({
        code: 'validation',
      });
      expect(await repo.list({})).toHaveLength(0);
    });

    it('rejects a title over the maximum length', async () => {
      await expect(service.create({ title: 'x'.repeat(141) })).rejects.toMatchObject({
        code: 'validation',
      });
    });

    it('rejects an invalid due date', async () => {
      await expect(
        service.create({ title: 'Task', dueAt: '2026-02-30' }),
      ).rejects.toMatchObject({ code: 'validation' });
      await expect(
        service.create({ title: 'Task', dueAt: 'tomorrow' }),
      ).rejects.toMatchObject({ code: 'validation' });
    });

    it('accepts and persists a valid due date', async () => {
      const task = await service.create({ title: 'Task', dueAt: '2026-10-31' });
      expect(task.dueAt).toBe('2026-10-31');
    });
  });

  describe('update', () => {
    it('updates fields and bumps updated_at while preserving created_at', async () => {
      const created = await service.create({ title: 'Draft', dueAt: '2026-10-20' });

      const updated = await service.update(created.id, {
        title: 'Final',
        priority: 'high',
        dueAt: null,
      });

      expect(updated.title).toBe('Final');
      expect(updated.priority).toBe('high');
      expect(updated.dueAt).toBeNull();
      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.updatedAt).not.toBe(created.updatedAt);

      expect(await repo.findById(created.id)).toEqual(updated);
    });

    it('keeps existing fields for undefined inputs', async () => {
      const created = await service.create({
        title: 'Keep me',
        description: 'Details',
        priority: 'low',
      });

      const updated = await service.update(created.id, { title: 'Renamed' });

      expect(updated.description).toBe('Details');
      expect(updated.priority).toBe('low');
    });

    it('rejects invalid titles and reports not-found for unknown ids', async () => {
      const created = await service.create({ title: 'Some task' });

      await expect(service.update(created.id, { title: ' ' })).rejects.toMatchObject({
        code: 'validation',
      });
      await expect(service.update('missing', { title: 'x' })).rejects.toMatchObject({
        code: 'not_found',
      });
    });
  });

  describe('setCompleted', () => {
    it('completes a task, setting completed_at and keeping the invariant', async () => {
      const created = await service.create({ title: 'Task' });

      const completed = await service.setCompleted(created.id, true);

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).not.toBeNull();
      expect(completed.completedAt).toBe(completed.updatedAt);
    });

    it('is idempotent: completing twice does not overwrite the original completed_at', async () => {
      const created = await service.create({ title: 'Task' });

      const first = await service.setCompleted(created.id, true);
      const second = await service.setCompleted(created.id, true);

      expect(second.completedAt).toBe(first.completedAt);
      expect(second.updatedAt).toBe(first.updatedAt);
    });

    it('reopens a completed task, clearing completed_at', async () => {
      const created = await service.create({ title: 'Task' });
      await service.setCompleted(created.id, true);

      const reopened = await service.setCompleted(created.id, false);

      expect(reopened.status).toBe('pending');
      expect(reopened.completedAt).toBeNull();
    });

    it('reopening a pending task is a no-op', async () => {
      const created = await service.create({ title: 'Task' });
      const reopened = await service.setCompleted(created.id, false);
      expect(reopened.updatedAt).toBe(created.updatedAt);
    });
  });

  describe('remove', () => {
    it('deletes an existing task', async () => {
      const created = await service.create({ title: 'Disposable' });
      await service.remove(created.id);
      expect(await repo.findById(created.id)).toBeNull();
    });

    it('throws a not_found AppError for an unknown id', async () => {
      await expect(service.remove('missing')).rejects.toBeInstanceOf(AppError);
      await expect(service.remove('missing')).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('list and getById', () => {
    it('filters through the repository', async () => {
      await service.create({ title: 'High one', priority: 'high' });
      await service.create({ title: 'Low one', priority: 'low' });

      const high = await service.list({ priority: 'high' });
      expect(high.map((t) => t.title)).toEqual(['High one']);
    });

    it('throws not_found when getting a missing task', async () => {
      await expect(service.getById('missing')).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('counts (dashboard figures)', () => {
    it('counts tasks with the same filters the list applies', async () => {
      await service.create({ title: 'Due today', dueAt: '2026-10-11' });
      await service.create({ title: 'Due later', dueAt: '2026-10-20' });
      await service.create({ title: 'Also today', dueAt: '2026-10-11' });

      expect(await service.count({ status: 'pending' })).toBe(3);
      expect(
        await service.count({ status: 'pending', dueOnOrBefore: '2026-10-11' }),
      ).toBe(2);
      expect(await service.count({ status: 'pending', dueBefore: '2026-10-11' })).toBe(0);
    });

    it('counts tasks completed within a UTC instant range (end exclusive)', async () => {
      const task = await service.create({ title: 'Done thing' });
      await service.setCompleted(task.id, true);

      // The tick clock stamps completions at 2026-10-11T08:00:0xZ.
      expect(
        await service.countCompletedBetween(
          '2026-10-11T00:00:00.000Z',
          '2026-10-12T00:00:00.000Z',
        ),
      ).toBe(1);
      expect(
        await service.countCompletedBetween(
          '2026-10-12T00:00:00.000Z',
          '2026-10-13T00:00:00.000Z',
        ),
      ).toBe(0);
      expect(
        await service.countCompletedBetween(
          '2026-10-11T00:00:00.000Z',
          '2026-10-11T08:00:00.000Z',
        ),
      ).toBe(0);
    });
  });

  describe('error mapping', () => {
    it('wraps unexpected storage errors as database AppErrors', async () => {
      const failingRepo: TaskRepository = {
        insert: async () => {
          throw new Error('disk glitch');
        },
        update: async () => {
          throw new Error('disk glitch');
        },
        findById: async () => {
          throw new Error('disk glitch');
        },
        list: async () => {
          throw new Error('disk glitch');
        },
        count: async () => {
          throw new Error('disk glitch');
        },
        countCompletedBetween: async () => {
          throw new Error('disk glitch');
        },
        delete: async () => {
          throw new Error('disk glitch');
        },
      };
      const failingService = createTaskService(failingRepo, { generateId: () => 'x' });

      await expect(failingService.getById('a')).rejects.toMatchObject({ code: 'database' });
      await expect(failingService.create({ title: 'T' })).rejects.toMatchObject({
        code: 'database',
      });
      await expect(failingService.count({})).rejects.toMatchObject({ code: 'database' });
    });
  });
});
