import { SqliteMedicineRepository } from '@/db/repositories/health-repository';
import { createMedicineService, type MedicineService } from '@/services/medicine-service';

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

describe('MedicineService', () => {
  let db: TestDatabase;
  let service: MedicineService;
  let nextId: number;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    nextId = 0;
    service = createMedicineService(new SqliteMedicineRepository(db), {
      now: createTickClock(),
      generateId: () => `generated-${++nextId}`,
    });
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('trims fields, defaults frequency, and stores schedules', async () => {
      const medicine = await service.create({
        name: '  Napa  ',
        strength: '500mg',
        schedules: [{ time: '08:00', weekdays: null }],
      });

      expect(medicine.name).toBe('Napa');
      expect(medicine.frequency).toBe('daily');
      expect(medicine.isArchived).toBe(false);
      expect(medicine.schedules).toHaveLength(1);
      expect(medicine.schedules[0]).toMatchObject({ time: '08:00', weekdays: null });
    });

    it('rejects a blank name without writing a row', async () => {
      await expect(service.create({ name: '   ' })).rejects.toMatchObject({
        code: 'validation',
      });
      expect(await service.list({})).toHaveLength(0);
    });

    it('requires dose times except for as-needed medicines', async () => {
      await expect(service.create({ name: 'X' })).rejects.toMatchObject({
        code: 'validation',
      });
      await expect(
        service.create({ name: 'X', frequency: 'as_needed', schedules: [{ time: '08:00' }] }),
      ).rejects.toMatchObject({ code: 'validation' });

      const prn = await service.create({ name: 'X', frequency: 'as_needed' });
      expect(prn.schedules).toHaveLength(0);
    });

    it('validates times, weekdays, and the date range', async () => {
      await expect(
        service.create({ name: 'X', schedules: [{ time: '8am' }] }),
      ).rejects.toMatchObject({ code: 'validation' });
      await expect(
        service.create({
          name: 'X',
          frequency: 'weekly',
          schedules: [{ time: '08:00', weekdays: [] }],
        }),
      ).rejects.toMatchObject({ code: 'validation' });
      await expect(
        service.create({
          name: 'X',
          startDate: '2026-10-12',
          endDate: '2026-10-01',
          schedules: [{ time: '08:00' }],
        }),
      ).rejects.toMatchObject({ code: 'validation' });
      await expect(
        service.create({ name: 'X', startDate: 'tomorrow', schedules: [{ time: '08:00' }] }),
      ).rejects.toMatchObject({ code: 'validation' });
    });
  });

  describe('update', () => {
    it('reconciles schedules by id, keeping logs of untouched rows', async () => {
      const created = await service.create({
        name: 'Napa',
        schedules: [
          { time: '08:00', weekdays: null },
          { time: '20:00', weekdays: null },
        ],
      });
      const [morning, evening] = created.schedules;
      await service.logDose(morning.id, '2026-10-12', 'taken');

      const updated = await service.update(created.id, {
        name: 'Napa Extra',
        schedules: [
          { id: morning.id, time: '09:00', weekdays: null },
          { time: '14:00', weekdays: null },
        ],
      });

      expect(updated.name).toBe('Napa Extra');
      expect(updated.schedules.map((s) => s.time)).toEqual(['09:00', '14:00']);
      // The kept row carries its id (and therefore its log) forward.
      expect(updated.schedules[0].id).toBe(morning.id);
      expect(evening).toBeDefined();

      const doses = await service.listDueDoses('2026-10-12');
      const kept = doses.find((dose) => dose.scheduleId === morning.id);
      expect(kept?.status).toBe('taken');
      expect(doses.some((dose) => dose.scheduleId === evening.id)).toBe(false);
    });

    it('rejects unknown schedule ids', async () => {
      const created = await service.create({
        name: 'Napa',
        schedules: [{ time: '08:00' }],
      });
      await expect(
        service.update(created.id, { schedules: [{ id: 'ghost', time: '09:00' }] }),
      ).rejects.toMatchObject({ code: 'validation' });
    });

    it('archives idempotently and removes medicines', async () => {
      const created = await service.create({
        name: 'Napa',
        schedules: [{ time: '08:00' }],
      });
      const archived = await service.setArchived(created.id, true);
      expect(archived.isArchived).toBe(true);
      expect(await service.setArchived(created.id, true)).toEqual(archived);

      await service.remove(created.id);
      await expect(service.getById(created.id)).rejects.toMatchObject({ code: 'not_found' });
      await expect(service.remove(created.id)).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('dose logs', () => {
    it('logs, updates, and clears a dose', async () => {
      const created = await service.create({
        name: 'Napa',
        schedules: [{ time: '08:00' }],
      });
      const scheduleId = created.schedules[0].id;

      const logged = await service.logDose(scheduleId, '2026-10-12', 'taken');
      expect(logged.status).toBe('taken');
      expect((await service.logDose(scheduleId, '2026-10-12', 'skipped')).status).toBe('skipped');

      expect(await service.clearDose(scheduleId, '2026-10-12')).toBe(true);
      expect(await service.clearDose(scheduleId, '2026-10-12')).toBe(false);
    });

    it('rejects unknown dose statuses', async () => {
      await expect(service.logDose('s', '2026-10-12', 'snoozed' as never)).rejects.toMatchObject({
        code: 'validation',
      });
    });
  });
});
