import { SqliteBillRepository } from '@/db/repositories/bill-repository';
import { createBillService, type BillService } from '@/services/bill-service';
import { AppError } from '@/utils/errors';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

function createTickClock(startSeconds = 0): () => string {
  let tick = startSeconds;
  return () => {
    const iso = `2026-10-11T08:00:${String(tick).padStart(2, '0')}.000Z`;
    tick += 1;
    return iso;
  };
}

/** Local calendar date used as "today": 2026-10-11. */
function fixedNowDate(): Date {
  return new Date(2026, 9, 11, 12, 0, 0);
}

const baseInput = {
  name: 'Electricity',
  category: 'electricity' as const,
  expectedAmountMinor: 125000,
  recurrence: 'monthly' as const,
  firstDueOn: '2026-10-15',
};

describe('BillService', () => {
  let db: TestDatabase;
  let repo: SqliteBillRepository;
  let service: BillService;
  let nextId: number;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    repo = new SqliteBillRepository(db);
    nextId = 0;
    service = createBillService(repo, {
      now: createTickClock(),
      nowDate: fixedNowDate,
      generateId: () => `generated-${++nextId}`,
    });
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('creates the bill and materializes occurrences up to the horizon', async () => {
      const bill = await service.create(baseInput);

      expect(bill.name).toBe('Electricity');
      expect(bill.isArchived).toBe(false);
      expect(bill.createdAt).toBe(bill.updatedAt);

      // Horizon is 2026-12-10 (today + 60 days): October and November dues
      // are materialized; the December one is not yet.
      const occurrences = await service.listOccurrences(bill.id);
      expect(occurrences.map((o) => o.dueOn)).toEqual(['2026-11-15', '2026-10-15']);
      expect(occurrences.every((o) => o.status === 'pending')).toBe(true);
      expect(occurrences.every((o) => o.expectedAmountMinor === 125000)).toBe(true);
    });

    it('trims the name and normalizes blank notes to null', async () => {
      const bill = await service.create({ ...baseInput, name: '  Rent  ', notes: '   ' });
      expect(bill.name).toBe('Rent');
      expect(bill.notes).toBeNull();
    });

    it('materializes exactly the installment count and never more', async () => {
      const bill = await service.create({
        ...baseInput,
        firstDueOn: '2026-10-01',
        installmentCount: 3,
      });

      await service.ensureOccurrencesAhead();
      await service.ensureOccurrencesAhead();

      const occurrences = await service.listOccurrences(bill.id);
      expect(occurrences.map((o) => o.dueOn).sort()).toEqual([
        '2026-10-01',
        '2026-11-01',
        '2026-12-01',
      ]);
    });

    it('creates a single occurrence for a one-off bill', async () => {
      const bill = await service.create({
        ...baseInput,
        recurrence: 'none',
        firstDueOn: '2026-11-01',
      });

      const occurrences = await service.listOccurrences(bill.id);
      expect(occurrences.map((o) => o.dueOn)).toEqual(['2026-11-01']);
    });

    it('materializes catch-up occurrences for a past first due date', async () => {
      const bill = await service.create({ ...baseInput, firstDueOn: '2026-08-31' });

      const occurrences = await service.listOccurrences(bill.id);
      expect(occurrences.map((o) => o.dueOn).sort()).toEqual([
        '2026-08-31',
        '2026-09-30',
        '2026-10-31',
        '2026-11-30',
      ]);
    });

    it('rejects invalid inputs without writing anything', async () => {
      const cases = [
        { ...baseInput, name: '   ' },
        { ...baseInput, expectedAmountMinor: 0 },
        { ...baseInput, expectedAmountMinor: 10.5 },
        { ...baseInput, category: 'nonsense' as never },
        { ...baseInput, recurrence: 'hourly' as never },
        { ...baseInput, firstDueOn: '2026-02-30' },
        { ...baseInput, installmentCount: 1 },
        { ...baseInput, installmentCount: 12, recurrence: 'none' as const },
        { ...baseInput, reminderDaysBefore: 31 },
        { ...baseInput, notes: 'x'.repeat(2001) },
      ];

      for (const input of cases) {
        await expect(service.create(input)).rejects.toMatchObject({ code: 'validation' });
      }
      expect(await service.listSummaries()).toHaveLength(0);
    });
  });

  describe('ensureOccurrencesAhead', () => {
    it('is idempotent and never duplicates or alters existing occurrences', async () => {
      const bill = await service.create(baseInput);
      await service.ensureOccurrencesAhead();
      await service.ensureOccurrencesAhead();

      const occurrences = await service.listOccurrences(bill.id);
      expect(occurrences).toHaveLength(2);
      expect(new Set(occurrences.map((o) => o.dueOn)).size).toBe(2);
    });

    it('slides the horizon forward as time passes', async () => {
      const bill = await service.create(baseInput);
      expect(await service.listOccurrences(bill.id)).toHaveLength(2);

      // Two months later the horizon reaches 2027-02-08.
      service = createBillService(repo, {
        now: createTickClock(30),
        nowDate: () => new Date(2026, 11, 11, 12, 0, 0),
        generateId: () => `later-${++nextId}`,
      });
      await service.ensureOccurrencesAhead();

      const due = await service.listOccurrences(bill.id);
      expect(due.map((o) => o.dueOn)).toEqual([
        '2027-01-15',
        '2026-12-15',
        '2026-11-15',
        '2026-10-15',
      ]);
    });

    it('resumes generation after a bill is restored, and skips archived bills', async () => {
      const bill = await service.create({ ...baseInput, firstDueOn: '2026-10-15' });
      await service.setArchived(bill.id, true);

      service = createBillService(repo, {
        now: createTickClock(30),
        nowDate: () => new Date(2026, 11, 11, 12, 0, 0),
        generateId: () => `later-${++nextId}`,
      });
      await service.ensureOccurrencesAhead();
      expect(await service.listOccurrences(bill.id)).toHaveLength(2);

      await service.setArchived(bill.id, false);
      await service.ensureOccurrencesAhead();
      expect((await service.listOccurrences(bill.id)).length).toBeGreaterThan(2);
    });
  });

  describe('update', () => {
    it('updates the definition and syncs pending occurrence amounts', async () => {
      const bill = await service.create(baseInput);
      const occurrences = await service.listOccurrences(bill.id);
      const first = occurrences.find((o) => o.dueOn === '2026-10-15');
      expect(first).toBeDefined();

      const updated = await service.update(bill.id, {
        name: 'Electricity (meter 2)',
        expectedAmountMinor: 150000,
        notes: 'Pay online',
      });

      expect(updated.name).toBe('Electricity (meter 2)');
      expect(updated.expectedAmountMinor).toBe(150000);
      expect(updated.notes).toBe('Pay online');
      expect(updated.updatedAt).not.toBe(bill.updatedAt);

      const after = await service.listOccurrences(bill.id);
      expect(after.every((o) => o.expectedAmountMinor === 150000)).toBe(true);
    });

    it('keeps paid history at the amount it was settled at', async () => {
      const bill = await service.create(baseInput);
      const [occurrence] = await service.listOccurrences(bill.id);
      await repo.markPaidIfPending(occurrence.id, {
        paidAmountMinor: 125000,
        paidOn: '2026-10-15',
        updatedAt: 'a',
      });

      await service.update(bill.id, { expectedAmountMinor: 150000 });

      const after = await service.listOccurrences(bill.id);
      const paid = after.find((o) => o.id === occurrence.id);
      const pending = after.find((o) => o.id !== occurrence.id);
      expect(paid?.expectedAmountMinor).toBe(125000);
      expect(pending?.expectedAmountMinor).toBe(150000);
    });

    it('validates inputs and reports not-found for unknown ids', async () => {
      const bill = await service.create(baseInput);
      await expect(service.update(bill.id, { name: ' ' })).rejects.toMatchObject({
        code: 'validation',
      });
      await expect(
        service.update(bill.id, { expectedAmountMinor: -1 }),
      ).rejects.toMatchObject({ code: 'validation' });
      await expect(
        service.update(bill.id, { reminderDaysBefore: 99 }),
      ).rejects.toMatchObject({ code: 'validation' });
      await expect(service.update('missing', { name: 'x' })).rejects.toMatchObject({
        code: 'not_found',
      });
    });
  });

  describe('archive and delete', () => {
    it('archives and restores a bill idempotently', async () => {
      const bill = await service.create(baseInput);

      const archived = await service.setArchived(bill.id, true);
      expect(archived.isArchived).toBe(true);
      const again = await service.setArchived(bill.id, true);
      expect(again.updatedAt).toBe(archived.updatedAt);

      expect((await service.listSummaries()).map((s) => s.id)).not.toContain(bill.id);
      expect(
        (await service.listSummaries({ includeArchived: true })).map((s) => s.id),
      ).toContain(bill.id);

      await service.setArchived(bill.id, false);
      expect((await service.listSummaries()).map((s) => s.id)).toContain(bill.id);
    });

    it('archived bills disappear from due lists and month totals', async () => {
      const bill = await service.create(baseInput);
      expect(await service.listDue()).toHaveLength(2);
      expect(await service.monthDueTotal()).toBe(125000);

      await service.setArchived(bill.id, true);

      expect(await service.listDue()).toHaveLength(0);
      expect(await service.monthDueTotal()).toBe(0);
    });

    it('deletes a bill without payments', async () => {
      const bill = await service.create(baseInput);
      await service.remove(bill.id);
      expect(await service.listSummaries()).toHaveLength(0);
      expect(await service.listOccurrences(bill.id)).toHaveLength(0);
    });

    it('refuses to delete a bill with payment history', async () => {
      const bill = await service.create(baseInput);
      const [occurrence] = await service.listOccurrences(bill.id);
      await repo.markPaidIfPending(occurrence.id, {
        paidAmountMinor: 125000,
        paidOn: '2026-10-15',
        updatedAt: 'a',
      });

      await expect(service.remove(bill.id)).rejects.toMatchObject({
        code: 'conflict',
        message: 'bill_has_payments',
      });
      expect(await repo.findById(bill.id)).not.toBeNull();
    });

    it('reports not-found when removing an unknown bill', async () => {
      await expect(service.remove('missing')).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('list queries', () => {
    it('lists due occurrences from every active bill ordered by due date', async () => {
      await service.create({ ...baseInput, name: 'Rent', category: 'rent', firstDueOn: '2026-10-20' });
      await service.create({ ...baseInput, name: 'Internet', category: 'internet', firstDueOn: '2026-10-05' });

      // Horizon 2026-12-10: Internet materializes 10-05/11-05/12-05 and Rent
      // 10-20/11-20, interleaved by due date across bills.
      const due = await service.listDue();
      expect(due.map((item) => `${item.billName}@${item.dueOn}`)).toEqual([
        'Internet@2026-10-05',
        'Rent@2026-10-20',
        'Internet@2026-11-05',
        'Rent@2026-11-20',
        'Internet@2026-12-05',
      ]);
      expect(due[0].billCategory).toBe('internet');
    });

    it('moves an occurrence from due to history when paid, and back when undone', async () => {
      const bill = await service.create(baseInput);
      const [occurrence] = await service.listDue();
      await repo.markPaidIfPending(occurrence.id, {
        paidAmountMinor: 130000,
        paidOn: '2026-10-14',
        updatedAt: 'a',
      });

      const history = await service.listHistory();
      expect(history.map((item) => item.id)).toEqual([occurrence.id]);
      expect(history[0]).toMatchObject({ paidAmountMinor: 130000, billName: bill.name });

      await repo.markUnpaidIfPaid(occurrence.id, 'b');
      expect(await service.listHistory()).toHaveLength(0);
      expect((await service.listDue()).map((item) => item.id)).toContain(occurrence.id);
    });

    it('keeps history visible for archived bills', async () => {
      const bill = await service.create(baseInput);
      const [occurrence] = await service.listDue();
      await repo.markPaidIfPending(occurrence.id, {
        paidAmountMinor: 125000,
        paidOn: '2026-10-15',
        updatedAt: 'a',
      });
      await service.setArchived(bill.id, true);

      expect((await service.listHistory()).map((item) => item.id)).toEqual([occurrence.id]);
    });

    it('computes the monthly due total from pending occurrences only', async () => {
      await service.create(baseInput);
      await service.create({
        ...baseInput,
        name: 'Water',
        category: 'water',
        expectedAmountMinor: 45000,
        firstDueOn: '2026-10-05',
      });
      const due = await service.listDue();
      expect(due[0]).toMatchObject({ billName: 'Water', dueOn: '2026-10-05' });
      await repo.markPaidIfPending(due[0].id, {
        paidAmountMinor: 45000,
        paidOn: '2026-10-05',
        updatedAt: 'a',
      });

      // October pending: Electricity 1250.00 (15 Oct). The paid Water amount
      // and the November dues are excluded from the current-month total.
      expect(await service.monthDueTotal()).toBe(125000);
    });
  });

  describe('error mapping', () => {
    it('wraps storage failures as database errors without leaking SQL', async () => {
      const closedDb = await createMigratedDatabase();
      const closedRepo = new SqliteBillRepository(closedDb);
      closedDb.close();
      const failing = createBillService(closedRepo, {
        now: createTickClock(),
        nowDate: fixedNowDate,
      });

      const error = await failing.listSummaries().catch((thrown: unknown) => thrown);
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('database');
      expect((error as AppError).message).not.toContain('SQLITE');
    });
  });
});
