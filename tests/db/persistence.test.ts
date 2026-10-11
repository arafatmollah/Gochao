import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getUserVersion, runMigrations } from '@/db/migrate';
import { SqliteTaskRepository } from '@/db/repositories/task-repository';

import { makeTask } from '../helpers/factories';
import { createNodeSqliteDatabase } from '../helpers/node-sqlite-database';

/**
 * Persistence across "app restarts": the data file is closed and reopened,
 * migrations re-run against it (as SQLiteProvider.onInit does on every
 * launch), and the records must still be there.
 */
describe('persistence across database reopen', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'jibon-test-'));
    path = join(dir, 'jibon.db');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('retains records after closing and reopening the database file', async () => {
    const first = createNodeSqliteDatabase(path);
    await first.execAsync('PRAGMA foreign_keys = ON;');
    await runMigrations(first);
    const repo = new SqliteTaskRepository(first);
    await repo.insert(makeTask({ id: 'persist-1', title: 'Survives restart' }));
    first.close();

    const second = createNodeSqliteDatabase(path);
    await second.execAsync('PRAGMA foreign_keys = ON;');
    const versionAfterReopen = await runMigrations(second);

    const repoAfterReopen = new SqliteTaskRepository(second);
    const task = await repoAfterReopen.findById('persist-1');

    expect(task?.title).toBe('Survives restart');
    expect(versionAfterReopen).toBe(await getUserVersion(second));

    const rows = await repoAfterReopen.list({ status: 'pending' });
    expect(rows).toHaveLength(1);

    second.close();
  });
});
