import { SqliteGroceryRepository } from '@/db/repositories/grocery-repository';
import type { GroceryItem, GroceryList } from '@/types/grocery';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

let db: TestDatabase;
let repo: SqliteGroceryRepository;

const T0 = '2026-10-01T08:00:00.000Z';
const T1 = '2026-10-02T08:00:00.000Z';

function makeList(overrides: Partial<GroceryList> = {}): GroceryList {
  return {
    id: 'list-1',
    name: 'Weekly shopping',
    notes: null,
    isArchived: false,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function makeItem(overrides: Partial<GroceryItem> = {}): GroceryItem {
  return {
    id: 'item-1',
    listId: 'list-1',
    name: 'Rice',
    quantity: 2,
    unit: 'kg',
    estimatedPriceMinor: 15000,
    actualPriceMinor: null,
    isPurchased: false,
    purchasedAt: null,
    assignedMemberId: null,
    notes: null,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

async function insertMember(id = 'member-1', name = 'Amina'): Promise<void> {
  await db.runAsync(
    `INSERT INTO family_members (id, name, relationship, contact, notes, is_archived, created_at, updated_at)
     VALUES (?, ?, 'self', NULL, NULL, 0, ?, ?)`,
    [id, name, T0, T0],
  );
}

beforeEach(async () => {
  db = await createMigratedDatabase();
  repo = new SqliteGroceryRepository(db);
});

afterEach(() => {
  db.close();
});

describe('GroceryRepository lists', () => {
  it('stores and reads back a list', async () => {
    await repo.insertList(makeList({ notes: 'Friday bazar' }));

    const loaded = await repo.findListById('list-1');
    expect(loaded).toEqual(makeList({ notes: 'Friday bazar' }));
    expect(await repo.findListById('missing')).toBeNull();
  });

  it('summarizes counts and price totals per list', async () => {
    await repo.insertList(makeList({ id: 'list-1' }));
    await repo.insertList(makeList({ id: 'list-2', name: 'Empty' }));
    await repo.insertItem(makeItem({ id: 'a', listId: 'list-1', estimatedPriceMinor: 10000, actualPriceMinor: null }));
    await repo.insertItem(
      makeItem({
        id: 'b',
        listId: 'list-1',
        estimatedPriceMinor: 5000,
        actualPriceMinor: 5500,
        isPurchased: true,
        purchasedAt: T1,
      }),
    );

    const summaries = await repo.listSummaries({});
    expect(summaries).toHaveLength(2);
    const first = summaries.find((s) => s.id === 'list-1');
    expect(first).toMatchObject({
      totalItems: 2,
      remainingItems: 1,
      estimatedTotalMinor: 15000,
      actualTotalMinor: 5500,
    });
    const empty = summaries.find((s) => s.id === 'list-2');
    expect(empty).toMatchObject({
      totalItems: 0,
      remainingItems: 0,
      estimatedTotalMinor: 0,
      actualTotalMinor: 0,
    });
  });

  it('orders active lists before archived ones', async () => {
    await repo.insertList(makeList({ id: 'old-active', updatedAt: T0 }));
    await repo.insertList(makeList({ id: 'arch', isArchived: true, updatedAt: T1 }));
    await repo.insertList(makeList({ id: 'new-active', updatedAt: T1 }));

    const ids = (await repo.listSummaries({})).map((s) => s.id);
    expect(ids).toEqual(['new-active', 'old-active', 'arch']);

    expect(await repo.countLists({})).toBe(3);
    expect(await repo.countLists({ archived: true })).toBe(1);
  });

  it('searches list names and escapes LIKE wildcards', async () => {
    await repo.insertList(makeList({ id: 'percent', name: '100% bazar' }));
    await repo.insertList(makeList({ id: 'other', name: '100x bazar' }));

    expect((await repo.listSummaries({ search: '100%' })).map((s) => s.id)).toEqual(['percent']);
    expect((await repo.listSummaries({ search: '100_' }))).toHaveLength(0);
  });

  it('deletes a list together with its items', async () => {
    await repo.insertList(makeList());
    await repo.insertItem(makeItem());

    expect(await repo.deleteList('list-1')).toBe(true);
    expect(await repo.findListById('list-1')).toBeNull();
    expect(await repo.listItems('list-1', {})).toHaveLength(0);
    expect(await repo.deleteList('list-1')).toBe(false);
  });
});

describe('GroceryRepository items', () => {
  beforeEach(async () => {
    await repo.insertList(makeList());
  });

  it('stores and reads back an item with its assignee name', async () => {
    await insertMember('member-1', 'Amina');
    await repo.insertItem(makeItem({ assignedMemberId: 'member-1', notes: 'Basmati' }));

    const loaded = await repo.findItemById('item-1');
    expect(loaded).toMatchObject({
      name: 'Rice',
      quantity: 2,
      unit: 'kg',
      assignedMemberId: 'member-1',
      assignedMemberName: 'Amina',
      notes: 'Basmati',
    });
    expect(await repo.findItemById('missing')).toBeNull();
  });

  it('lists remaining items before purchased ones', async () => {
    await repo.insertItem(makeItem({ id: 'done', isPurchased: true, purchasedAt: T1 }));
    await repo.insertItem(makeItem({ id: 'todo' }));

    const ids = (await repo.listItems('list-1', {})).map((i) => i.id);
    expect(ids).toEqual(['todo', 'done']);

    expect((await repo.listItems('list-1', { purchased: false })).map((i) => i.id)).toEqual([
      'todo',
    ]);
    expect(await repo.countRemaining('list-1')).toBe(1);
    expect(await repo.countItems('list-1')).toBe(2);
    expect(await repo.sumTotals('list-1')).toEqual({
      estimatedTotalMinor: 30000,
      actualTotalMinor: 0,
    });
  });

  it('searches item names literally', async () => {
    await repo.insertItem(makeItem({ id: 'a', name: 'Salt 50% off' }));
    await repo.insertItem(makeItem({ id: 'b', name: 'Sugar' }));

    expect((await repo.listItems('list-1', { search: '50%' })).map((i) => i.id)).toEqual(['a']);
  });

  it('clears the assignee when the member row is deleted', async () => {
    await insertMember('member-1', 'Amina');
    await repo.insertItem(makeItem({ assignedMemberId: 'member-1' }));
    await db.runAsync('DELETE FROM family_members WHERE id = ?', ['member-1']);

    const loaded = await repo.findItemById('item-1');
    expect(loaded?.assignedMemberId).toBeNull();
    expect(loaded?.assignedMemberName).toBeNull();
  });

  it('checks member existence and lists active members by name', async () => {
    await insertMember('member-1', 'Salim');
    await insertMember('member-2', 'Amina');
    await db.runAsync(
      `INSERT INTO family_members (id, name, relationship, contact, notes, is_archived, created_at, updated_at)
       VALUES ('member-3', 'Archived', 'other', NULL, NULL, 1, ?, ?)`,
      [T0, T0],
    );

    expect(await repo.memberExists('member-1')).toBe(true);
    expect(await repo.memberExists('missing')).toBe(false);
    expect(await repo.listActiveMembers()).toEqual([
      { id: 'member-2', name: 'Amina' },
      { id: 'member-1', name: 'Salim' },
    ]);
  });

  it('updates and deletes items', async () => {
    await repo.insertItem(makeItem());
    const loaded = await repo.findItemById('item-1');
    expect(loaded).not.toBeNull();

    await repo.updateItem({ ...makeItem(), name: 'Miniket rice', quantity: 5 });
    expect((await repo.findItemById('item-1'))?.name).toBe('Miniket rice');
    expect((await repo.findItemById('item-1'))?.quantity).toBe(5);

    expect(await repo.deleteItem('item-1')).toBe(true);
    expect(await repo.findItemById('item-1')).toBeNull();
    expect(await repo.deleteItem('item-1')).toBe(false);
  });

  it('enforces the purchased invariant and positive quantity', async () => {
    // Purchased without a timestamp violates the CHECK constraint.
    await expect(
      repo.insertItem(makeItem({ isPurchased: true, purchasedAt: null })),
    ).rejects.toThrow();
    await expect(repo.insertItem(makeItem({ id: 'zero', quantity: 0 }))).rejects.toThrow();
  });
});
