import { SqliteBillRepository } from '@/db/repositories/bill-repository';
import type { Bill } from '@/types/bill';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'bill-1',
    name: 'Electricity',
    category: 'electricity',
    expectedAmountMinor: 125000,
    recurrence: 'monthly',
    firstDueOn: '2026-10-15',
    installmentCount: null,
    reminderDaysBefore: null,
    notes: null,
    isArchived: false,
    createdAt: '2026-10-11T08:00:00.000Z',
    updatedAt: '2026-10-11T08:00:00.000Z',
    ...overrides,
  };
}

function makeOccurrence(
  id: string,
  billId: string,
  dueOn: string,
  overrides: Partial<Parameters<SqliteBillRepository['insertOccurrence']>[0]> = {},
) {
  return {
    id,
    billId,
    dueOn,
    expectedAmountMinor: 125000,
    createdAt: '2026-10-11T08:00:00.000Z',
    updatedAt: '2026-10-11T08:00:00.000Z',
    ...overrides,
  };
}

describe('SqliteBillRepository', () => {
  let db: TestDatabase;
  let repo: SqliteBillRepository;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    repo = new SqliteBillRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('bills', () => {
    it('round-trips a bill through insert and findById', async () => {
      const bill = makeBill({
        installmentCount: 12,
        reminderDaysBefore: 3,
        notes: 'Pay by card',
        isArchived: true,
      });
      await repo.insert(bill);

      expect(await repo.findById(bill.id)).toEqual(bill);
    });

    it('returns null for an unknown id', async () => {
      expect(await repo.findById('missing')).toBeNull();
    });

    it('updates every editable column', async () => {
      await repo.insert(makeBill());

      const updated = makeBill({
        name: 'Electricity (new meter)',
        category: 'other',
        expectedAmountMinor: 99000,
        reminderDaysBefore: 0,
        notes: 'changed',
        isArchived: true,
        updatedAt: '2026-10-12T09:00:00.000Z',
      });
      await repo.update(updated);

      expect(await repo.findById(updated.id)).toEqual(updated);
    });

    it('enforces the schema constraints', async () => {
      await expect(
        db.runAsync(
          `INSERT INTO bills (id, name, category, expected_amount_minor, recurrence, first_due_on, is_archived, created_at, updated_at)
           VALUES ('x', 'Bad', 'nonsense', 100, 'monthly', '2026-10-01', 0, 't', 't')`,
        ),
      ).rejects.toThrow();

      await expect(
        db.runAsync(
          `INSERT INTO bills (id, name, category, expected_amount_minor, recurrence, first_due_on, is_archived, created_at, updated_at)
           VALUES ('x', 'Bad', 'rent', 0, 'monthly', '2026-10-01', 0, 't', 't')`,
        ),
      ).rejects.toThrow();

      await expect(
        db.runAsync(
          `INSERT INTO bills (id, name, category, expected_amount_minor, recurrence, first_due_on, installment_count, is_archived, created_at, updated_at)
           VALUES ('x', 'Bad', 'rent', 100, 'monthly', '2026-10-01', 1, 0, 't', 't')`,
        ),
      ).rejects.toThrow();

      await expect(
        db.runAsync(
          `INSERT INTO bills (id, name, category, expected_amount_minor, recurrence, first_due_on, reminder_days_before, is_archived, created_at, updated_at)
           VALUES ('x', 'Bad', 'rent', 100, 'monthly', '2026-10-01', 31, 0, 't', 't')`,
        ),
      ).rejects.toThrow();

      await expect(
        db.runAsync(
          `INSERT INTO bills (id, name, category, expected_amount_minor, recurrence, first_due_on, is_archived, created_at, updated_at)
           VALUES ('x', 'Bad', 'rent', 100, 'monthly', '01-10-2026', 0, 't', 't')`,
        ),
      ).rejects.toThrow();
    });

    it('lists summaries with derived schedule facts', async () => {
      await repo.insert(makeBill({ id: 'b1', name: 'Rent', firstDueOn: '2026-10-01' }));
      await repo.insert(makeBill({ id: 'b2', name: 'Internet', firstDueOn: '2026-10-05' }));
      await repo.insertOccurrence(makeOccurrence('o1', 'b1', '2026-10-01'));
      await repo.insertOccurrence(makeOccurrence('o2', 'b1', '2026-11-01'));
      await repo.insertOccurrence(makeOccurrence('o3', 'b2', '2026-10-05'));
      await repo.markPaidIfPending('o1', {
        paidAmountMinor: 125000,
        paidOn: '2026-10-01',
        updatedAt: '2026-10-01T10:00:00.000Z',
      });

      const summaries = await repo.listSummaries();

      expect(summaries.map((summary) => summary.id)).toEqual(['b2', 'b1']);
      const rent = summaries.find((summary) => summary.id === 'b1');
      expect(rent).toMatchObject({
        nextDueOn: '2026-11-01',
        paidCount: 1,
        occurrenceCount: 2,
      });
      const internet = summaries.find((summary) => summary.id === 'b2');
      expect(internet).toMatchObject({
        nextDueOn: '2026-10-05',
        paidCount: 0,
        occurrenceCount: 1,
      });
    });

    it('orders summaries: active first, soonest due first, no-pending last', async () => {
      await repo.insert(makeBill({ id: 'later', name: 'Later', firstDueOn: '2026-12-01' }));
      await repo.insert(makeBill({ id: 'none', name: 'None', firstDueOn: '2026-11-01' }));
      await repo.insert(
        makeBill({ id: 'archived', name: 'Archived', firstDueOn: '2026-10-01', isArchived: true }),
      );
      await repo.insert(makeBill({ id: 'sooner', name: 'Sooner', firstDueOn: '2026-10-20' }));
      await repo.insertOccurrence(makeOccurrence('o-sooner', 'sooner', '2026-10-20'));
      await repo.insertOccurrence(makeOccurrence('o-later', 'later', '2026-12-01'));
      await repo.insertOccurrence(makeOccurrence('o-archived', 'archived', '2026-10-01'));

      const summaries = await repo.listSummaries();
      expect(summaries.map((summary) => summary.id)).toEqual(['sooner', 'later', 'none']);
    });

    it('includes archived bills on request', async () => {
      await repo.insert(makeBill({ id: 'a', name: 'Archived', isArchived: true }));
      await repo.insert(makeBill({ id: 'b', name: 'Active' }));

      expect((await repo.listSummaries()).map((s) => s.id)).toEqual(['b']);
      expect((await repo.listSummaries({ includeArchived: true })).map((s) => s.id)).toEqual([
        'b',
        'a',
      ]);
    });
  });

  describe('occurrences', () => {
    it('is idempotent per (bill, due date) and leaves the original row untouched', async () => {
      await repo.insert(makeBill());
      await repo.insertOccurrence(makeOccurrence('o1', 'bill-1', '2026-10-15'));
      await repo.insertOccurrence(
        makeOccurrence('o2', 'bill-1', '2026-10-15', { expectedAmountMinor: 999 }),
      );

      const occurrences = await repo.listByBill('bill-1');
      expect(occurrences).toHaveLength(1);
      expect(occurrences[0]).toMatchObject({ id: 'o1', expectedAmountMinor: 125000 });
    });

    it('rejects a raw duplicate (bill_id, due_on) pair', async () => {
      await repo.insert(makeBill());
      await repo.insertOccurrence(makeOccurrence('o1', 'bill-1', '2026-10-15'));

      await expect(
        db.runAsync(
          `INSERT INTO bill_occurrences (id, bill_id, due_on, expected_amount_minor, status, created_at, updated_at)
           VALUES ('o2', 'bill-1', '2026-10-15', 100, 'pending', 't', 't')`,
        ),
      ).rejects.toThrow();
    });

    it('rejects occurrences for unknown bills and paid rows without payment data', async () => {
      await expect(
        db.runAsync(
          `INSERT INTO bill_occurrences (id, bill_id, due_on, expected_amount_minor, status, created_at, updated_at)
           VALUES ('x', 'missing', '2026-10-15', 100, 'pending', 't', 't')`,
        ),
      ).rejects.toThrow();

      await repo.insert(makeBill());
      await expect(
        db.runAsync(
          `INSERT INTO bill_occurrences (id, bill_id, due_on, expected_amount_minor, status, created_at, updated_at)
           VALUES ('y', 'bill-1', '2026-10-16', 100, 'paid', 't', 't')`,
        ),
      ).rejects.toThrow();
    });

    it('lists due occurrences ordered by due date, joining bill fields', async () => {
      await repo.insert(makeBill({ id: 'b1', name: 'Rent', category: 'rent' }));
      await repo.insert(makeBill({ id: 'b2', name: 'Internet', category: 'internet' }));
      await repo.insertOccurrence(makeOccurrence('o2', 'b2', '2026-10-20'));
      await repo.insertOccurrence(makeOccurrence('o1', 'b1', '2026-10-10'));
      await repo.insertOccurrence(makeOccurrence('o3', 'b1', '2026-10-25'));

      const due = await repo.listOccurrences({ status: 'pending' });

      expect(due.map((item) => item.id)).toEqual(['o1', 'o2', 'o3']);
      expect(due[0]).toMatchObject({ billName: 'Rent', billCategory: 'rent' });
    });

    it('excludes archived bills from due lists but keeps their history', async () => {
      await repo.insert(makeBill({ id: 'b1', name: 'Subscription', isArchived: true }));
      await repo.insertOccurrence(makeOccurrence('o1', 'b1', '2026-09-01'));
      await repo.insertOccurrence(makeOccurrence('o2', 'b1', '2026-10-01'));
      await repo.markPaidIfPending('o1', {
        paidAmountMinor: 50000,
        paidOn: '2026-09-01',
        updatedAt: '2026-09-01T10:00:00.000Z',
      });

      expect(await repo.listOccurrences({ status: 'pending' })).toHaveLength(0);

      const history = await repo.listOccurrences({ status: 'paid', includeArchivedBills: true });
      expect(history.map((item) => item.id)).toEqual(['o1']);
    });

    it('filters by due date and paginates', async () => {
      await repo.insert(makeBill());
      for (const day of ['01', '02', '03', '04']) {
        await repo.insertOccurrence(makeOccurrence(`o${day}`, 'bill-1', `2026-10-${day}`));
      }

      const firstPage = await repo.listOccurrences({ status: 'pending', limit: 2 });
      expect(firstPage.map((item) => item.id)).toEqual(['o01', 'o02']);

      const secondPage = await repo.listOccurrences({ status: 'pending', limit: 2, offset: 2 });
      expect(secondPage.map((item) => item.id)).toEqual(['o03', 'o04']);

      const bounded = await repo.listOccurrences({ status: 'pending', dueOnOrBefore: '2026-10-02' });
      expect(bounded.map((item) => item.id)).toEqual(['o01', 'o02']);
    });

    it('lists paid occurrences most recently paid first', async () => {
      await repo.insert(makeBill());
      await repo.insertOccurrence(makeOccurrence('o1', 'bill-1', '2026-09-01'));
      await repo.insertOccurrence(makeOccurrence('o2', 'bill-1', '2026-10-01'));
      await repo.markPaidIfPending('o1', {
        paidAmountMinor: 50000,
        paidOn: '2026-09-02',
        updatedAt: 'z',
      });
      await repo.markPaidIfPending('o2', {
        paidAmountMinor: 60000,
        paidOn: '2026-10-03',
        updatedAt: 'z',
      });

      const history = await repo.listOccurrences({ status: 'paid' });
      expect(history.map((item) => item.id)).toEqual(['o2', 'o1']);
      expect(history[0]).toMatchObject({ paidAmountMinor: 60000, paidOn: '2026-10-03' });
    });
  });

  describe('payment operations', () => {
    it('marks a pending occurrence paid exactly once', async () => {
      await repo.insert(makeBill());
      await repo.insertOccurrence(makeOccurrence('o1', 'bill-1', '2026-10-15'));

      const first = await repo.markPaidIfPending('o1', {
        paidAmountMinor: 120000,
        paidOn: '2026-10-14',
        updatedAt: '2026-10-14T09:00:00.000Z',
      });
      expect(first).toBe(true);

      const second = await repo.markPaidIfPending('o1', {
        paidAmountMinor: 999999,
        paidOn: '2026-10-20',
        updatedAt: '2026-10-20T09:00:00.000Z',
      });
      expect(second).toBe(false);

      const [occurrence] = await repo.listByBill('bill-1');
      expect(occurrence).toMatchObject({
        status: 'paid',
        paidAmountMinor: 120000,
        paidOn: '2026-10-14',
      });
    });

    it('marks a paid occurrence unpaid exactly once', async () => {
      await repo.insert(makeBill());
      await repo.insertOccurrence(makeOccurrence('o1', 'bill-1', '2026-10-15'));
      await repo.markPaidIfPending('o1', {
        paidAmountMinor: 120000,
        paidOn: '2026-10-14',
        updatedAt: 'a',
      });

      expect(await repo.markUnpaidIfPaid('o1', 'b')).toBe(true);
      expect(await repo.markUnpaidIfPaid('o1', 'c')).toBe(false);

      const [occurrence] = await repo.listByBill('bill-1');
      expect(occurrence).toMatchObject({
        status: 'pending',
        paidAmountMinor: null,
        paidOn: null,
      });
    });

    it('syncs expected amounts of pending occurrences only', async () => {
      await repo.insert(makeBill());
      await repo.insertOccurrence(makeOccurrence('o1', 'bill-1', '2026-10-15'));
      await repo.insertOccurrence(makeOccurrence('o2', 'bill-1', '2026-11-15'));
      await repo.markPaidIfPending('o1', {
        paidAmountMinor: 125000,
        paidOn: '2026-10-15',
        updatedAt: 'a',
      });

      await repo.syncPendingExpectedAmount('bill-1', 150000, 'b');

      const occurrences = await repo.listByBill('bill-1');
      const paid = occurrences.find((o) => o.id === 'o1');
      const pending = occurrences.find((o) => o.id === 'o2');
      expect(paid?.expectedAmountMinor).toBe(125000);
      expect(pending?.expectedAmountMinor).toBe(150000);
    });

    it('deletes a bill with no payments together with its occurrences', async () => {
      await repo.insert(makeBill());
      await repo.insertOccurrence(makeOccurrence('o1', 'bill-1', '2026-10-15'));

      expect(await repo.deleteIfNoPayments('bill-1')).toBe(true);
      expect(await repo.findById('bill-1')).toBeNull();
      expect(await repo.listByBill('bill-1')).toHaveLength(0);
    });

    it('refuses to delete a bill that has payment history', async () => {
      await repo.insert(makeBill());
      await repo.insertOccurrence(makeOccurrence('o1', 'bill-1', '2026-10-15'));
      await repo.markPaidIfPending('o1', {
        paidAmountMinor: 125000,
        paidOn: '2026-10-15',
        updatedAt: 'a',
      });

      expect(await repo.deleteIfNoPayments('bill-1')).toBe(false);
      expect(await repo.findById('bill-1')).not.toBeNull();
      expect(await repo.listByBill('bill-1')).toHaveLength(1);
    });

    it('returns false when deleting a bill that does not exist', async () => {
      expect(await repo.deleteIfNoPayments('missing')).toBe(false);
    });
  });

  describe('aggregations', () => {
    it('sums pending expected amounts within [start, end), excluding paid and archived', async () => {
      await repo.insert(makeBill({ id: 'b1' }));
      await repo.insert(makeBill({ id: 'b2', isArchived: true }));
      await repo.insertOccurrence(makeOccurrence('sep', 'b1', '2026-09-30'));
      await repo.insertOccurrence(makeOccurrence('oct1', 'b1', '2026-10-01'));
      await repo.insertOccurrence(makeOccurrence('oct2', 'b1', '2026-10-31'));
      await repo.insertOccurrence(
        makeOccurrence('nov', 'b1', '2026-11-01', { expectedAmountMinor: 1 }),
      );
      await repo.insertOccurrence(makeOccurrence('arch', 'b2', '2026-10-15'));
      await repo.markPaidIfPending('oct2', {
        paidAmountMinor: 125000,
        paidOn: '2026-10-31',
        updatedAt: 'a',
      });

      const total = await repo.sumPendingDueBetween('2026-10-01', '2026-11-01');
      expect(total).toBe(125000);
    });

    it('lists generation candidates for active bills with schedule facts', async () => {
      await repo.insert(makeBill({ id: 'b1' }));
      await repo.insert(makeBill({ id: 'b2', isArchived: true }));
      await repo.insertOccurrence(makeOccurrence('o1', 'b1', '2026-10-15'));
      await repo.insertOccurrence(makeOccurrence('o2', 'b1', '2026-11-15'));
      await repo.insertOccurrence(makeOccurrence('arch', 'b2', '2026-10-01'));

      const candidates = await repo.listGenerationCandidates();

      expect(candidates).toHaveLength(1);
      expect(candidates[0].bill.id).toBe('b1');
      expect(candidates[0].lastDueOn).toBe('2026-11-15');
      expect(candidates[0].occurrenceCount).toBe(2);
    });
  });
});
