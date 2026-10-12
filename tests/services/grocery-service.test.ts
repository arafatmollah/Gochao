import { SqliteGroceryRepository } from '@/db/repositories/grocery-repository';
import { createGroceryService, type GroceryService } from '@/services/grocery-service';

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

const T0 = '2026-10-01T08:00:00.000Z';

async function insertMember(db: TestDatabase, id = 'member-1', name = 'Amina'): Promise<void> {
  await db.runAsync(
    `INSERT INTO family_members (id, name, relationship, contact, notes, is_archived, created_at, updated_at)
     VALUES (?, ?, 'self', NULL, NULL, 0, ?, ?)`,
    [id, name, T0, T0],
  );
}

describe('GroceryService', () => {
  let db: TestDatabase;
  let service: GroceryService;
  let nextId: number;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    const repo = new SqliteGroceryRepository(db);
    nextId = 0;
    service = createGroceryService(repo, {
      now: createTickClock(),
      generateId: () => `generated-${++nextId}`,
    });
  });

  afterEach(() => {
    db.close();
  });

  describe('lists', () => {
    it('trims the name and applies defaults on create', async () => {
      const list = await service.createList({ name: '  Weekly shopping  ' });

      expect(list.name).toBe('Weekly shopping');
      expect(list.notes).toBeNull();
      expect(list.isArchived).toBe(false);
      expect(list.id).toBe('generated-1');
      expect(list.createdAt).toBe(list.updatedAt);
    });

    it('rejects a blank or overlong name without writing a row', async () => {
      await expect(service.createList({ name: '   ' })).rejects.toMatchObject({
        code: 'validation',
      });
      await expect(service.createList({ name: 'x'.repeat(121) })).rejects.toMatchObject({
        code: 'validation',
      });
      expect(await service.listSummaries({})).toHaveLength(0);
    });

    it('updates, archives idempotently, and removes lists', async () => {
      const list = await service.createList({ name: 'Trip' });

      const updated = await service.updateList(list.id, { name: 'Big trip', notes: 'Friday' });
      expect(updated.name).toBe('Big trip');
      expect(updated.notes).toBe('Friday');

      const archived = await service.setArchived(list.id, true);
      expect(archived.isArchived).toBe(true);
      // Repeating the transition returns the same record.
      expect(await service.setArchived(list.id, true)).toEqual(archived);

      await service.removeList(list.id);
      await expect(service.getListById(list.id)).rejects.toMatchObject({ code: 'not_found' });
      await expect(service.removeList(list.id)).rejects.toMatchObject({ code: 'not_found' });
    });

    it('throws not_found for unknown lists', async () => {
      await expect(service.getListById('missing')).rejects.toMatchObject({ code: 'not_found' });
      await expect(service.updateList('missing', { name: 'x' })).rejects.toMatchObject({
        code: 'not_found',
      });
      await expect(service.setArchived('missing', true)).rejects.toMatchObject({
        code: 'not_found',
      });
    });
  });

  describe('items', () => {
    it('creates an item with defaults (quantity 1, unpurchased)', async () => {
      const list = await service.createList({ name: 'Trip' });
      const item = await service.createItem(list.id, { name: '  Eggs  ' });

      expect(item.name).toBe('Eggs');
      expect(item.quantity).toBe(1);
      expect(item.unit).toBeNull();
      expect(item.isPurchased).toBe(false);
      expect(item.purchasedAt).toBeNull();
      expect(item.listId).toBe(list.id);
    });

    it('rejects items on a missing list', async () => {
      await expect(service.createItem('missing', { name: 'Rice' })).rejects.toMatchObject({
        code: 'not_found',
      });
    });

    it('validates name, quantity, prices, and the assignee', async () => {
      const list = await service.createList({ name: 'Trip' });

      await expect(service.createItem(list.id, { name: '  ' })).rejects.toMatchObject({
        code: 'validation',
      });
      await expect(service.createItem(list.id, { name: 'Rice', quantity: 0 })).rejects.toMatchObject(
        { code: 'validation' },
      );
      await expect(
        service.createItem(list.id, { name: 'Rice', quantity: 1.555 }),
      ).rejects.toMatchObject({ code: 'validation' });
      await expect(
        service.createItem(list.id, { name: 'Rice', estimatedPriceMinor: -5 }),
      ).rejects.toMatchObject({ code: 'validation' });
      await expect(
        service.createItem(list.id, { name: 'Rice', assignedMemberId: 'ghost' }),
      ).rejects.toMatchObject({ code: 'validation' });
      expect(await service.countItems(list.id)).toBe(0);
    });

    it('accepts a real member as assignee and real prices', async () => {
      await insertMember(db);
      const list = await service.createList({ name: 'Trip' });
      const item = await service.createItem(list.id, {
        name: 'Oil',
        quantity: 2.5,
        unit: 'L',
        estimatedPriceMinor: 120000,
        actualPriceMinor: 118500,
        assignedMemberId: 'member-1',
        notes: 'Mustard',
      });

      expect(item.quantity).toBe(2.5);
      expect(item.assignedMemberId).toBe('member-1');

      const loaded = await service.getItemById(item.id);
      expect(loaded.assignedMemberName).toBe('Amina');
    });

    it('checks off and reopens items with the purchased invariant', async () => {
      const list = await service.createList({ name: 'Trip' });
      const item = await service.createItem(list.id, { name: 'Rice' });

      const purchased = await service.setPurchased(item.id, true);
      expect(purchased.isPurchased).toBe(true);
      expect(purchased.purchasedAt).not.toBeNull();
      // Idempotent: repeating the transition returns the same record.
      expect(await service.setPurchased(item.id, true)).toEqual(purchased);

      const reopened = await service.setPurchased(item.id, false);
      expect(reopened.isPurchased).toBe(false);
      expect(reopened.purchasedAt).toBeNull();

      expect(await service.countRemaining(list.id)).toBe(1);
    });

    it('updates and removes items', async () => {
      const list = await service.createList({ name: 'Trip' });
      const item = await service.createItem(list.id, { name: 'Rice', quantity: 1 });

      const updated = await service.updateItem(item.id, { quantity: 5, unit: 'kg' });
      expect(updated.quantity).toBe(5);
      expect(updated.unit).toBe('kg');

      await service.removeItem(item.id);
      await expect(service.getItemById(item.id)).rejects.toMatchObject({ code: 'not_found' });
    });

    it('lists items of one list only and sums totals', async () => {
      const first = await service.createList({ name: 'First' });
      const second = await service.createList({ name: 'Second' });
      await service.createItem(first.id, { name: 'Rice', estimatedPriceMinor: 10000 });
      await service.createItem(second.id, { name: 'Oil', estimatedPriceMinor: 20000 });

      expect((await service.listItems(first.id)).map((i) => i.name)).toEqual(['Rice']);
      expect(await service.sumTotals(first.id)).toEqual({
        estimatedTotalMinor: 10000,
        actualTotalMinor: 0,
      });
      await expect(service.listItems('missing')).rejects.toMatchObject({ code: 'not_found' });
    });
  });
});
