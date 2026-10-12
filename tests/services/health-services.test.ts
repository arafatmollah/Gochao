import {
  SqliteAppointmentRepository,
  SqliteHealthRecordRepository,
} from '@/db/repositories/health-repository';
import { createAppointmentService, type AppointmentService } from '@/services/appointment-service';
import {
  createHealthRecordService,
  type HealthRecordService,
} from '@/services/health-record-service';

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

describe('AppointmentService', () => {
  let db: TestDatabase;
  let service: AppointmentService;
  let nextId: number;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    nextId = 0;
    service = createAppointmentService(new SqliteAppointmentRepository(db), {
      now: createTickClock(),
      generateId: () => `generated-${++nextId}`,
    });
  });

  afterEach(() => {
    db.close();
  });

  it('creates, updates, and splits upcoming and past visits', async () => {
    const visit = await service.create({
      title: '  Dental checkup  ',
      doctor: 'Dr. Ali',
      date: '2026-10-20',
      time: '10:30',
    });
    expect(visit.title).toBe('Dental checkup');
    expect(visit.time).toBe('10:30');

    const updated = await service.update(visit.id, { place: 'City Hospital' });
    expect(updated.place).toBe('City Hospital');

    expect((await service.listUpcoming('2026-10-12')).map((v) => v.id)).toEqual([visit.id]);
    expect(await service.listPast('2026-10-12')).toHaveLength(0);

    await service.remove(visit.id);
    await expect(service.getById(visit.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('validates title, date, and time', async () => {
    await expect(service.create({ title: '  ', date: '2026-10-20' })).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(service.create({ title: 'X', date: 'next Friday' })).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(
      service.create({ title: 'X', date: '2026-10-20', time: '10am' }),
    ).rejects.toMatchObject({ code: 'validation' });
  });
});

describe('HealthRecordService', () => {
  let db: TestDatabase;
  let service: HealthRecordService;
  let nextId: number;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    nextId = 0;
    service = createHealthRecordService(new SqliteHealthRecordRepository(db), {
      now: createTickClock(),
      generateId: () => `generated-${++nextId}`,
    });
  });

  afterEach(() => {
    db.close();
  });

  it('defaults the recorded date to today and lists newest first', async () => {
    const note = await service.create({ title: '  Blood pressure  ', content: '120/80' });
    expect(note.title).toBe('Blood pressure');
    expect(note.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const older = await service.create({ title: 'Old', recordedOn: '2026-10-01' });
    expect((await service.list()).map((r) => r.id)).toEqual([older.id, note.id]);

    const updated = await service.update(note.id, { content: '121/81' });
    expect(updated.content).toBe('121/81');

    await service.remove(note.id);
    await expect(service.getById(note.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('validates title and date', async () => {
    await expect(service.create({ title: '' })).rejects.toMatchObject({ code: 'validation' });
    await expect(service.create({ title: 'X', recordedOn: 'yesterday' })).rejects.toMatchObject({
      code: 'validation',
    });
  });
});
