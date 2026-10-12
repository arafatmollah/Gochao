import { SqliteFamilyMemberRepository } from '@/db/repositories/family-member-repository';
import { SqliteFamilyRequestRepository } from '@/db/repositories/family-request-repository';
import { SqliteTaskRepository } from '@/db/repositories/task-repository';
import type { FamilyMember, FamilyRequest } from '@/types/family';
import type { Task } from '@/types/task';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

let db: TestDatabase;
let members: SqliteFamilyMemberRepository;
let requests: SqliteFamilyRequestRepository;
let tasks: SqliteTaskRepository;

const T0 = '2026-10-01T08:00:00.000Z';
const T1 = '2026-10-02T08:00:00.000Z';
const T2 = '2026-10-03T08:00:00.000Z';

function makeMember(overrides: Partial<FamilyMember> = {}): FamilyMember {
  return {
    id: 'member-1',
    name: 'Ayesha',
    relationship: 'spouse',
    contact: null,
    notes: null,
    isArchived: false,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<FamilyRequest> = {}): FamilyRequest {
  return {
    id: 'req-1',
    title: 'Buy medicine for father',
    details: null,
    memberId: null,
    category: 'medicine',
    priority: 'medium',
    deadline: null,
    estimatedCostMinor: null,
    status: 'open',
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  const timestamp = overrides.createdAt ?? T0;
  return {
    id: 'task-1',
    title: 'Test task',
    description: null,
    dueAt: null,
    priority: 'medium',
    status: 'pending',
    parentTaskId: null,
    familyRequestId: null,
    createdAt: timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
    completedAt:
      overrides.completedAt ??
      (overrides.status === 'completed' ? (overrides.updatedAt ?? timestamp) : null),
    ...overrides,
  };
}

beforeEach(async () => {
  db = await createMigratedDatabase();
  members = new SqliteFamilyMemberRepository(db);
  requests = new SqliteFamilyRequestRepository(db);
  tasks = new SqliteTaskRepository(db);
});

afterEach(() => {
  db.close();
});

describe('FamilyMemberRepository', () => {
  it('stores and reads back a member with contact and notes', async () => {
    await members.insert(
      makeMember({ contact: '01711-000000', notes: 'Prefers evening calls' }),
    );

    const loaded = await members.findById('member-1');
    expect(loaded).toEqual(makeMember({ contact: '01711-000000', notes: 'Prefers evening calls' }));
  });

  it('defaults is_archived to 0 at the schema level', async () => {
    await members.insert(makeMember());
    const row = await db.getFirstAsync<{ is_archived: number }>(
      'SELECT is_archived FROM family_members WHERE id = ?',
      ['member-1'],
    );
    expect(row?.is_archived).toBe(0);
  });

  it('rejects blank names at the schema level', async () => {
    await expect(members.insert(makeMember({ name: '   ' }))).rejects.toThrow();
  });

  it('rejects unknown relationships and statuses at the schema level', async () => {
    await expect(
      members.insert(makeMember({ relationship: 'cousin' as FamilyMember['relationship'] })),
    ).rejects.toThrow();
  });

  it('updates fields and archives a member', async () => {
    await members.insert(makeMember());
    await members.update(makeMember({ contact: '01819-000000', updatedAt: T1 }));

    const loaded = await members.findById('member-1');
    expect(loaded?.contact).toBe('01819-000000');
    expect(loaded?.isArchived).toBe(false);

    await members.update(makeMember({ isArchived: true, updatedAt: T2 }));
    expect((await members.findById('member-1'))?.isArchived).toBe(true);
  });

  it('lists active members first alphabetically, archived members last', async () => {
    await members.insert(makeMember({ id: 'zara', name: 'Zara' }));
    await members.insert(makeMember({ id: 'abul', name: 'Abul' }));
    await members.insert(makeMember({ id: 'mitu', name: 'Mitu', isArchived: true }));

    const ids = (await members.list({})).map((member) => member.id);
    expect(ids).toEqual(['abul', 'zara', 'mitu']);
  });

  it('filters members by archived flag and name search with LIKE escaping', async () => {
    await members.insert(makeMember({ id: 'r100', name: 'Rahim 100%' }));
    await members.insert(makeMember({ id: 'rahim', name: 'Rahim' }));
    await members.insert(makeMember({ id: 'karim', name: 'Karim', isArchived: true }));

    const active = await members.list({ archived: false });
    expect(active.map((member) => member.id)).toEqual(['rahim', 'r100']);

    const archived = await members.list({ archived: true });
    expect(archived.map((member) => member.id)).toEqual(['karim']);

    const wildcard = await members.list({ search: '100%' });
    expect(wildcard.map((member) => member.id)).toEqual(['r100']);

    expect(await members.count({ archived: false })).toBe(2);
  });

  it('deletes an unreferenced member but refuses when requests point at them', async () => {
    await members.insert(makeMember({ id: 'free' }));
    await members.insert(makeMember({ id: 'busy' }));
    await requests.insert(makeRequest({ id: 'req-1', memberId: 'busy' }));

    expect(await members.deleteIfUnreferenced('missing')).toBe(false);
    expect(await members.deleteIfUnreferenced('busy')).toBe(false);
    expect(await members.findById('busy')).not.toBeNull();

    expect(await members.deleteIfUnreferenced('free')).toBe(true);
    expect(await members.findById('free')).toBeNull();
  });
});

describe('FamilyRequestRepository', () => {
  it('stores and reads back a request, joining member name and task link', async () => {
    await members.insert(makeMember({ id: 'member-1', name: 'Ayesha' }));
    await requests.insert(
      makeRequest({
        memberId: 'member-1',
        deadline: '2026-10-20',
        estimatedCostMinor: 450_00,
        details: 'From Square Pharmacy',
      }),
    );

    const loaded = await requests.findById('req-1');
    expect(loaded).toEqual(
      makeRequest({
        memberId: 'member-1',
        deadline: '2026-10-20',
        estimatedCostMinor: 450_00,
        details: 'From Square Pharmacy',
      }),
    );

    const [item] = await requests.list({});
    expect(item.memberName).toBe('Ayesha');
    expect(item.taskId).toBeNull();
  });

  it('rejects blank titles, bad deadlines, and non-positive costs at the schema level', async () => {
    await expect(requests.insert(makeRequest({ title: ' ' }))).rejects.toThrow();
    await expect(requests.insert(makeRequest({ deadline: '20/10/2026' }))).rejects.toThrow();
    await expect(requests.insert(makeRequest({ estimatedCostMinor: 0 }))).rejects.toThrow();
    await expect(requests.insert(makeRequest({ status: 'closed' as never }))).rejects.toThrow();
  });

  it('orders outstanding work by deadline (nulls last), then priority, then settled requests oldest first', async () => {
    await requests.insert(makeRequest({ id: 'open-nodate', title: 'Open no date' }));
    await requests.insert(
      makeRequest({ id: 'open-late', title: 'Open late', deadline: '2026-10-25', priority: 'low' }),
    );
    await requests.insert(
      makeRequest({
        id: 'open-soon-high',
        title: 'Open soon high',
        deadline: '2026-10-15',
        priority: 'high',
      }),
    );
    await requests.insert(
      makeRequest({
        id: 'open-soon-med',
        title: 'Open soon medium',
        deadline: '2026-10-15',
        priority: 'medium',
      }),
    );
    await requests.insert(
      makeRequest({ id: 'wip', title: 'In progress', status: 'in_progress', deadline: '2026-10-10' }),
    );
    await requests.insert(
      makeRequest({ id: 'done', title: 'Done', status: 'done', createdAt: T0, updatedAt: T1 }),
    );
    await requests.insert(
      makeRequest({
        id: 'cancelled',
        title: 'Cancelled',
        status: 'cancelled',
        createdAt: T1,
        updatedAt: T2,
      }),
    );

    const ids = (await requests.list({})).map((request) => request.id);
    expect(ids).toEqual([
      'open-soon-high',
      'open-soon-med',
      'open-late',
      'open-nodate',
      'wip',
      'done',
      'cancelled',
    ]);
  });

  it('appends a newly added request below same-group requests', async () => {
    await requests.insert(makeRequest({ id: 'first', title: 'First' }));
    await requests.insert(
      makeRequest({ id: 'second', title: 'Second', createdAt: T1, updatedAt: T1 }),
    );

    const ids = (await requests.list({ status: 'open' })).map((request) => request.id);
    expect(ids).toEqual(['first', 'second']);
  });

  it('filters by status, member, outstanding-only, and search with escaping', async () => {
    await members.insert(makeMember({ id: 'member-1', name: 'Ayesha' }));
    await requests.insert(makeRequest({ id: 'open', memberId: 'member-1' }));
    await requests.insert(
      makeRequest({ id: 'done', title: 'Buy 100% cotton', status: 'done' }),
    );
    await requests.insert(
      makeRequest({ id: 'wip', status: 'in_progress', memberId: 'member-1', updatedAt: T1 }),
    );

    const open = await requests.list({ status: 'open' });
    expect(open.map((request) => request.id)).toEqual(['open']);

    const outstanding = await requests.list({ outstandingOnly: true });
    expect(outstanding.map((request) => request.id)).toEqual(['open', 'wip']);

    const byMember = await requests.list({ memberId: 'member-1' });
    expect(byMember.map((request) => request.id)).toEqual(['open', 'wip']);

    const wildcard = await requests.list({ search: '100%' });
    expect(wildcard.map((request) => request.id)).toEqual(['done']);

    expect(await requests.count({ outstandingOnly: true })).toBe(2);
  });

  it('serves the dashboard preview: outstanding only, nearest deadline first', async () => {
    await requests.insert(makeRequest({ id: 'nodate', title: 'No deadline' }));
    await requests.insert(
      makeRequest({ id: 'far', title: 'Far', deadline: '2026-11-01' }),
    );
    await requests.insert(
      makeRequest({ id: 'soon', title: 'Soon', deadline: '2026-10-14' }),
    );
    await requests.insert(makeRequest({ id: 'done', title: 'Done', status: 'done' }));

    const preview = await requests.listOutstanding(2);
    expect(preview.map((request) => request.id)).toEqual(['soon', 'far']);
    expect(await requests.countOutstanding()).toBe(3);
  });

  it('links a generated task and enforces one task per request', async () => {
    await members.insert(makeMember());
    await requests.insert(makeRequest());
    await tasks.insert(makeTask({ id: 'task-1', familyRequestId: 'req-1' }));

    expect(await requests.findTaskLink('req-1')).toBe('task-1');
    expect(await requests.findTaskLink('req-other')).toBeNull();

    const [item] = await requests.list({});
    expect(item.taskId).toBe('task-1');

    await expect(
      tasks.insert(makeTask({ id: 'task-2', familyRequestId: 'req-1' })),
    ).rejects.toThrow();
  });

  it('keeps the generated task (link cleared) when the request is deleted', async () => {
    await requests.insert(makeRequest());
    await tasks.insert(makeTask({ id: 'task-1', familyRequestId: 'req-1' }));

    expect(await requests.delete('req-1')).toBe(true);
    expect(await requests.delete('req-1')).toBe(false);

    const task = await tasks.findById('task-1');
    expect(task).not.toBeNull();
    expect(task?.familyRequestId).toBeNull();
  });

  it('unassigns requests when their member is force-deleted via the schema FK', async () => {
    await members.insert(makeMember({ id: 'member-1' }));
    await requests.insert(makeRequest({ memberId: 'member-1' }));

    await db.runAsync('DELETE FROM family_members WHERE id = ?', ['member-1']);
    expect((await requests.findById('req-1'))?.memberId).toBeNull();
  });

  it('clears the task link when the request is force-deleted via the schema FK', async () => {
    await requests.insert(makeRequest());
    await tasks.insert(makeTask({ id: 'task-1', familyRequestId: 'req-1' }));

    await db.runAsync('DELETE FROM family_requests WHERE id = ?', ['req-1']);
    expect((await tasks.findById('task-1'))?.familyRequestId).toBeNull();
  });

  it('updates fields including status transitions', async () => {
    await requests.insert(makeRequest());
    await requests.update(
      makeRequest({
        status: 'in_progress',
        priority: 'high',
        estimatedCostMinor: 120_00,
        updatedAt: T1,
      }),
    );

    const loaded = await requests.findById('req-1');
    expect(loaded?.status).toBe('in_progress');
    expect(loaded?.priority).toBe('high');
    expect(loaded?.estimatedCostMinor).toBe(120_00);
  });
});
