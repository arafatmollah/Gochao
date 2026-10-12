import {
  SqliteAppointmentRepository,
  SqliteHealthRecordRepository,
  SqliteMedicineRepository,
} from '@/db/repositories/health-repository';
import type { Medicine } from '@/types/health';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

let db: TestDatabase;
let medicines: SqliteMedicineRepository;
let appointments: SqliteAppointmentRepository;
let records: SqliteHealthRecordRepository;

const T0 = '2026-10-01T08:00:00.000Z';

function makeMedicine(overrides: Partial<Medicine> = {}): Medicine {
  return {
    id: 'med-1',
    name: 'Napa',
    strength: '500mg',
    dosage: '1 tablet after food',
    frequency: 'daily',
    startDate: null,
    endDate: null,
    prescriber: 'Dr. Karim',
    notes: null,
    isArchived: false,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

beforeEach(async () => {
  db = await createMigratedDatabase();
  medicines = new SqliteMedicineRepository(db);
  appointments = new SqliteAppointmentRepository(db);
  records = new SqliteHealthRecordRepository(db);
});

afterEach(() => {
  db.close();
});

describe('MedicineRepository', () => {
  it('stores a medicine with its schedules', async () => {
    await medicines.insertMedicine(makeMedicine());
    await medicines.insertSchedule({
      id: 'sch-1',
      medicineId: 'med-1',
      time: '08:00',
      weekdays: null,
      createdAt: T0,
    });
    await medicines.insertSchedule({
      id: 'sch-2',
      medicineId: 'med-1',
      time: '20:00',
      weekdays: ['1', '3', '5'],
      createdAt: T0,
    });

    const loaded = await medicines.findMedicineById('med-1');
    expect(loaded?.name).toBe('Napa');
    expect(loaded?.schedules.map((s) => s.time)).toEqual(['08:00', '20:00']);
    expect(loaded?.schedules[1].weekdays).toEqual(['1', '3', '5']);
    expect(await medicines.findMedicineById('missing')).toBeNull();
  });

  it('lists due doses for a date honoring range and weekdays', async () => {
    // 2026-10-12 is a Monday (ISO weekday 1).
    await medicines.insertMedicine(makeMedicine({ id: 'daily' }));
    await medicines.insertSchedule({
      id: 's-daily',
      medicineId: 'daily',
      time: '08:00',
      weekdays: null,
      createdAt: T0,
    });
    await medicines.insertMedicine(makeMedicine({ id: 'monwed', name: 'Weekly' }));
    await medicines.insertSchedule({
      id: 's-monwed',
      medicineId: 'monwed',
      time: '09:00',
      weekdays: ['1', '3'],
      createdAt: T0,
    });
    await medicines.insertMedicine(makeMedicine({ id: 'tue', name: 'Tuesday' }));
    await medicines.insertSchedule({
      id: 's-tue',
      medicineId: 'tue',
      time: '09:00',
      weekdays: ['2'],
      createdAt: T0,
    });
    await medicines.insertMedicine(
      makeMedicine({ id: 'ended', name: 'Old course', endDate: '2026-10-01' }),
    );
    await medicines.insertSchedule({
      id: 's-ended',
      medicineId: 'ended',
      time: '09:00',
      weekdays: null,
      createdAt: T0,
    });
    await medicines.insertMedicine(makeMedicine({ id: 'arch', name: 'Archived', isArchived: true }));
    await medicines.insertSchedule({
      id: 's-arch',
      medicineId: 'arch',
      time: '09:00',
      weekdays: null,
      createdAt: T0,
    });

    const monday = await medicines.listDueDoses('2026-10-12');
    expect(monday.map((dose) => dose.medicineName)).toEqual(['Napa', 'Weekly']);

    // Tuesday 2026-10-13: the Monday/Wednesday schedule drops out.
    const tuesday = await medicines.listDueDoses('2026-10-13');
    expect(tuesday.map((dose) => dose.medicineName)).toEqual(['Napa', 'Tuesday']);
  });

  it('joins the recorded status onto due doses', async () => {
    await medicines.insertMedicine(makeMedicine());
    await medicines.insertSchedule({
      id: 's-1',
      medicineId: 'med-1',
      time: '08:00',
      weekdays: null,
      createdAt: T0,
    });
    await medicines.upsertLog({
      scheduleId: 's-1',
      date: '2026-10-12',
      status: 'taken',
      loggedAt: T0,
      updatedAt: T0,
    });

    const doses = await medicines.listDueDoses('2026-10-12');
    expect(doses).toHaveLength(1);
    expect(doses[0].status).toBe('taken');

    expect(await medicines.deleteLog('s-1', '2026-10-12')).toBe(true);
    expect((await medicines.listDueDoses('2026-10-12'))[0].status).toBeNull();
    expect(await medicines.deleteLog('s-1', '2026-10-12')).toBe(false);
  });

  it('counts taken/total logs per medicine since a date', async () => {
    await medicines.insertMedicine(makeMedicine({ id: 'a' }));
    await medicines.insertSchedule({ id: 's-a', medicineId: 'a', time: '08:00', weekdays: null, createdAt: T0 });
    await medicines.upsertLog({ scheduleId: 's-a', date: '2026-10-10', status: 'taken', loggedAt: T0, updatedAt: T0 });
    await medicines.upsertLog({ scheduleId: 's-a', date: '2026-10-11', status: 'skipped', loggedAt: T0, updatedAt: T0 });
    await medicines.upsertLog({ scheduleId: 's-a', date: '2026-10-01', status: 'taken', loggedAt: T0, updatedAt: T0 });

    expect(await medicines.countLogsSince('2026-10-10')).toEqual([
      { medicineId: 'a', taken: 1, total: 2 },
    ]);
    expect(await medicines.countLogsSince('2026-10-12')).toEqual([]);
  });

  it('deletes a medicine with its schedules and logs', async () => {
    await medicines.insertMedicine(makeMedicine());
    await medicines.insertSchedule({
      id: 's-1',
      medicineId: 'med-1',
      time: '08:00',
      weekdays: null,
      createdAt: T0,
    });
    await medicines.upsertLog({
      scheduleId: 's-1',
      date: '2026-10-12',
      status: 'taken',
      loggedAt: T0,
      updatedAt: T0,
    });

    expect(await medicines.deleteMedicine('med-1')).toBe(true);
    expect(await medicines.findMedicineById('med-1')).toBeNull();
    expect(await medicines.deleteMedicine('med-1')).toBe(false);
  });

  it('searches medicines and filters archived', async () => {
    await medicines.insertMedicine(makeMedicine({ id: 'a', name: 'Napa Extra' }));
    await medicines.insertMedicine(makeMedicine({ id: 'b', name: 'Vitamin C', isArchived: true }));

    expect((await medicines.listMedicines({ search: 'napa' })).map((m) => m.id)).toEqual(['a']);
    expect((await medicines.listMedicines({ archived: true })).map((m) => m.id)).toEqual(['b']);
    expect((await medicines.listMedicines({ archived: false })).map((m) => m.id)).toEqual(['a']);
  });
});

describe('AppointmentRepository', () => {
  it('splits upcoming and past by date', async () => {
    const base = {
      title: 'Checkup',
      doctor: null,
      place: null,
      time: null,
      notes: null,
      createdAt: T0,
      updatedAt: T0,
    };
    await appointments.insert({ ...base, id: 'past', date: '2026-10-01' });
    await appointments.insert({ ...base, id: 'today', date: '2026-10-12' });
    await appointments.insert({ ...base, id: 'future', date: '2026-10-20' });

    expect((await appointments.listUpcoming('2026-10-12')).map((a) => a.id)).toEqual([
      'today',
      'future',
    ]);
    expect((await appointments.listPast('2026-10-12')).map((a) => a.id)).toEqual(['past']);

    expect(await appointments.delete('past')).toBe(true);
    expect(await appointments.findById('past')).toBeNull();
  });
});

describe('HealthRecordRepository', () => {
  it('lists notes oldest first so new notes append below', async () => {
    const base = { title: 'Note', content: null, createdAt: T0, updatedAt: T0 };
    await records.insert({ ...base, id: 'old', recordedOn: '2026-10-01' });
    await records.insert({ ...base, id: 'new', recordedOn: '2026-10-12' });

    expect((await records.list()).map((r) => r.id)).toEqual(['old', 'new']);
    expect(await records.delete('old')).toBe(true);
    expect(await records.delete('old')).toBe(false);
  });
});
