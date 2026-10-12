import type {
  Appointment,
  DoseLog,
  DoseStatus,
  DueDose,
  HealthRecord,
  Medicine,
  MedicineFilter,
  MedicineFrequency,
  MedicineSchedule,
  MedicineWithSchedules,
  Weekday,
} from '@/types/health';

import { escapeLikePattern, type SqlDatabase, type SqlParam } from '../sql';

interface MedicineRow {
  id: string;
  name: string;
  strength: string | null;
  dosage: string | null;
  frequency: MedicineFrequency;
  start_date: string | null;
  end_date: string | null;
  prescriber: string | null;
  notes: string | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

interface MedicineScheduleRow {
  id: string;
  medicine_id: string;
  time: string;
  weekdays: string | null;
  created_at: string;
}

interface AppointmentRow {
  id: string;
  title: string;
  doctor: string | null;
  place: string | null;
  date: string;
  time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface HealthRecordRow {
  id: string;
  title: string;
  content: string | null;
  recorded_on: string;
  created_at: string;
  updated_at: string;
}

/** `['1','3']` <-> `'1,3'` (sorted); null stays null (every day). */
export function weekdaysToCsv(weekdays: Weekday[] | null | undefined): string | null {
  if (weekdays === null || weekdays === undefined) {
    return null;
  }
  return [...weekdays].sort().join(',');
}

export function weekdaysFromCsv(value: string | null): Weekday[] | null {
  if (value === null || value === '') {
    return null;
  }
  return value.split(',') as Weekday[];
}

function mapMedicineRow(row: MedicineRow): Medicine {
  return {
    id: row.id,
    name: row.name,
    strength: row.strength,
    dosage: row.dosage,
    frequency: row.frequency,
    startDate: row.start_date,
    endDate: row.end_date,
    prescriber: row.prescriber,
    notes: row.notes,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScheduleRow(row: MedicineScheduleRow): MedicineSchedule {
  return {
    id: row.id,
    medicineId: row.medicine_id,
    time: row.time,
    weekdays: weekdaysFromCsv(row.weekdays),
    createdAt: row.created_at,
  };
}

function mapAppointmentRow(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    title: row.title,
    doctor: row.doctor,
    place: row.place,
    date: row.date,
    time: row.time,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHealthRecordRow(row: HealthRecordRow): HealthRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    recordedOn: row.recorded_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const DEFAULT_MEDICINE_LIST_LIMIT = 200;

export interface MedicineRepository {
  insertMedicine(medicine: Medicine): Promise<void>;
  updateMedicine(medicine: Medicine): Promise<void>;
  findMedicineById(id: string): Promise<MedicineWithSchedules | null>;
  listMedicines(filter: MedicineFilter): Promise<MedicineWithSchedules[]>;
  deleteMedicine(id: string): Promise<boolean>;

  insertSchedule(schedule: MedicineSchedule): Promise<void>;
  updateSchedule(schedule: MedicineSchedule): Promise<void>;
  deleteSchedule(id: string): Promise<boolean>;
  /** Checklist entries due on a date: active, in range, weekday matches. */
  listDueDoses(date: string): Promise<DueDose[]>;
  /** Taken/skipped counts per medicine since (and including) `sinceDate`. */
  countLogsSince(
    sinceDate: string,
  ): Promise<{ medicineId: string; taken: number; total: number }[]>;

  upsertLog(log: DoseLog): Promise<void>;
  deleteLog(scheduleId: string, date: string): Promise<boolean>;
}

const MEDICINE_COLUMNS = `
  id, name, strength, dosage, frequency, start_date, end_date,
  prescriber, notes, is_archived, created_at, updated_at
`;

function buildMedicineFilter(filter: MedicineFilter): { where: string; params: SqlParam[] } {
  const conditions: string[] = [];
  const params: SqlParam[] = [];

  if (filter.archived !== undefined) {
    conditions.push('is_archived = ?');
    params.push(filter.archived ? 1 : 0);
  }
  if (filter.search && filter.search.trim() !== '') {
    conditions.push(`name LIKE ? ESCAPE '\\'`);
    params.push(`%${escapeLikePattern(filter.search.trim())}%`);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

export class SqliteMedicineRepository implements MedicineRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insertMedicine(medicine: Medicine): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO medicines (
         id, name, strength, dosage, frequency, start_date, end_date,
         prescriber, notes, is_archived, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medicine.id,
        medicine.name,
        medicine.strength,
        medicine.dosage,
        medicine.frequency,
        medicine.startDate,
        medicine.endDate,
        medicine.prescriber,
        medicine.notes,
        medicine.isArchived ? 1 : 0,
        medicine.createdAt,
        medicine.updatedAt,
      ],
    );
  }

  async updateMedicine(medicine: Medicine): Promise<void> {
    await this.db.runAsync(
      `UPDATE medicines
          SET name = ?, strength = ?, dosage = ?, frequency = ?,
              start_date = ?, end_date = ?, prescriber = ?, notes = ?,
              is_archived = ?, updated_at = ?
        WHERE id = ?`,
      [
        medicine.name,
        medicine.strength,
        medicine.dosage,
        medicine.frequency,
        medicine.startDate,
        medicine.endDate,
        medicine.prescriber,
        medicine.notes,
        medicine.isArchived ? 1 : 0,
        medicine.updatedAt,
        medicine.id,
      ],
    );
  }

  async findMedicineById(id: string): Promise<MedicineWithSchedules | null> {
    const row = await this.db.getFirstAsync<MedicineRow>(
      `SELECT ${MEDICINE_COLUMNS} FROM medicines WHERE id = ?`,
      [id],
    );
    if (!row) {
      return null;
    }
    const schedules = await this.listSchedules(id);
    return { ...mapMedicineRow(row), schedules };
  }

  async listMedicines(filter: MedicineFilter): Promise<MedicineWithSchedules[]> {
    const { where, params } = buildMedicineFilter(filter);
    const limit = filter.limit ?? DEFAULT_MEDICINE_LIST_LIMIT;
    const offset = filter.offset ?? 0;

    const rows = await this.db.getAllAsync<MedicineRow>(
      `SELECT ${MEDICINE_COLUMNS} FROM medicines ${where}
       ORDER BY is_archived ASC, name COLLATE NOCASE ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    const medicines = rows.map(mapMedicineRow);
    // One extra query total (not per medicine): schedules for all listed ids.
    const schedulesByMedicine = await this.listSchedulesFor(
      medicines.map((medicine) => medicine.id),
    );
    return medicines.map((medicine) => ({
      ...medicine,
      schedules: schedulesByMedicine.get(medicine.id) ?? [],
    }));
  }

  async deleteMedicine(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM medicines WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async insertSchedule(schedule: MedicineSchedule): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO medicine_schedules (id, medicine_id, time, weekdays, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        schedule.id,
        schedule.medicineId,
        schedule.time,
        weekdaysToCsv(schedule.weekdays),
        schedule.createdAt,
      ],
    );
  }

  async updateSchedule(schedule: MedicineSchedule): Promise<void> {
    await this.db.runAsync(
      `UPDATE medicine_schedules SET time = ?, weekdays = ? WHERE id = ? AND medicine_id = ?`,
      [schedule.time, weekdaysToCsv(schedule.weekdays), schedule.id, schedule.medicineId],
    );
  }

  async deleteSchedule(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM medicine_schedules WHERE id = ?', [id]);
    return result.changes > 0;
  }

  private async listSchedules(medicineId: string): Promise<MedicineSchedule[]> {
    const rows = await this.db.getAllAsync<MedicineScheduleRow>(
      `SELECT id, medicine_id, time, weekdays, created_at FROM medicine_schedules
        WHERE medicine_id = ? ORDER BY time ASC`,
      [medicineId],
    );
    return rows.map(mapScheduleRow);
  }

  private async listSchedulesFor(
    medicineIds: string[],
  ): Promise<Map<string, MedicineSchedule[]>> {
    const grouped = new Map<string, MedicineSchedule[]>();
    if (medicineIds.length === 0) {
      return grouped;
    }
    const placeholders = medicineIds.map(() => '?').join(',');
    const rows = await this.db.getAllAsync<MedicineScheduleRow>(
      `SELECT id, medicine_id, time, weekdays, created_at FROM medicine_schedules
        WHERE medicine_id IN (${placeholders}) ORDER BY time ASC`,
      medicineIds,
    );
    for (const row of rows) {
      const schedule = mapScheduleRow(row);
      const list = grouped.get(schedule.medicineId) ?? [];
      list.push(schedule);
      grouped.set(schedule.medicineId, list);
    }
    return grouped;
  }

  async listDueDoses(date: string): Promise<DueDose[]> {
    const rows = await this.db.getAllAsync<{
      schedule_id: string;
      medicine_id: string;
      medicine_name: string;
      dosage: string | null;
      time: string;
      status: DoseStatus | null;
    }>(
      `SELECT s.id AS schedule_id, m.id AS medicine_id, m.name AS medicine_name,
              m.dosage AS dosage, s.time AS time, l.status AS status
         FROM medicine_schedules s
         JOIN medicines m ON m.id = s.medicine_id
         LEFT JOIN medicine_logs l
           ON l.schedule_id = s.id AND l.date = ?
        WHERE m.is_archived = 0
          AND (m.start_date IS NULL OR m.start_date <= ?)
          AND (m.end_date IS NULL OR m.end_date >= ?)
          AND (s.weekdays IS NULL
               OR instr(',' || s.weekdays || ',', ',' || strftime('%u', ?) || ',') > 0)
        ORDER BY s.time ASC, m.name COLLATE NOCASE ASC`,
      [date, date, date, date],
    );
    return rows.map((row) => ({
      scheduleId: row.schedule_id,
      medicineId: row.medicine_id,
      medicineName: row.medicine_name,
      dosage: row.dosage,
      time: row.time,
      date,
      status: row.status,
    }));
  }

  async countLogsSince(
    sinceDate: string,
  ): Promise<{ medicineId: string; taken: number; total: number }[]> {
    const rows = await this.db.getAllAsync<{
      medicine_id: string;
      taken: number;
      total: number;
    }>(
      `SELECT m.id AS medicine_id,
              SUM(CASE WHEN l.status = 'taken' THEN 1 ELSE 0 END) AS taken,
              COUNT(l.status) AS total
         FROM medicine_logs l
         JOIN medicine_schedules s ON s.id = l.schedule_id
         JOIN medicines m ON m.id = s.medicine_id
        WHERE l.date >= ?
        GROUP BY m.id`,
      [sinceDate],
    );
    return rows.map((row) => ({ medicineId: row.medicine_id, taken: row.taken, total: row.total }));
  }

  async upsertLog(log: DoseLog): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO medicine_logs (schedule_id, date, status, logged_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (schedule_id, date) DO UPDATE SET
         status = excluded.status,
         logged_at = excluded.logged_at,
         updated_at = excluded.updated_at`,
      [log.scheduleId, log.date, log.status, log.loggedAt, log.updatedAt],
    );
  }

  async deleteLog(scheduleId: string, date: string): Promise<boolean> {
    const result = await this.db.runAsync(
      'DELETE FROM medicine_logs WHERE schedule_id = ? AND date = ?',
      [scheduleId, date],
    );
    return result.changes > 0;
  }
}

export interface AppointmentRepository {
  insert(appointment: Appointment): Promise<void>;
  update(appointment: Appointment): Promise<void>;
  findById(id: string): Promise<Appointment | null>;
  /** All appointments on or after `fromDate`, soonest first. */
  listUpcoming(fromDate: string, limit?: number): Promise<Appointment[]>;
  /** All appointments before `fromDate`, most recent first. */
  listPast(fromDate: string, limit?: number): Promise<Appointment[]>;
  delete(id: string): Promise<boolean>;
}

const APPOINTMENT_COLUMNS = 'id, title, doctor, place, date, time, notes, created_at, updated_at';

export class SqliteAppointmentRepository implements AppointmentRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(appointment: Appointment): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO appointments (id, title, doctor, place, date, time, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appointment.id,
        appointment.title,
        appointment.doctor,
        appointment.place,
        appointment.date,
        appointment.time,
        appointment.notes,
        appointment.createdAt,
        appointment.updatedAt,
      ],
    );
  }

  async update(appointment: Appointment): Promise<void> {
    await this.db.runAsync(
      `UPDATE appointments
          SET title = ?, doctor = ?, place = ?, date = ?, time = ?, notes = ?, updated_at = ?
        WHERE id = ?`,
      [
        appointment.title,
        appointment.doctor,
        appointment.place,
        appointment.date,
        appointment.time,
        appointment.notes,
        appointment.updatedAt,
        appointment.id,
      ],
    );
  }

  async findById(id: string): Promise<Appointment | null> {
    const row = await this.db.getFirstAsync<AppointmentRow>(
      `SELECT ${APPOINTMENT_COLUMNS} FROM appointments WHERE id = ?`,
      [id],
    );
    return row ? mapAppointmentRow(row) : null;
  }

  async listUpcoming(fromDate: string, limit = 50): Promise<Appointment[]> {
    const rows = await this.db.getAllAsync<AppointmentRow>(
      `SELECT ${APPOINTMENT_COLUMNS} FROM appointments
        WHERE date >= ? ORDER BY date ASC, time ASC LIMIT ?`,
      [fromDate, limit],
    );
    return rows.map(mapAppointmentRow);
  }

  async listPast(fromDate: string, limit = 50): Promise<Appointment[]> {
    const rows = await this.db.getAllAsync<AppointmentRow>(
      `SELECT ${APPOINTMENT_COLUMNS} FROM appointments
        WHERE date < ? ORDER BY date DESC, time DESC LIMIT ?`,
      [fromDate, limit],
    );
    return rows.map(mapAppointmentRow);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM appointments WHERE id = ?', [id]);
    return result.changes > 0;
  }
}

export interface HealthRecordRepository {
  insert(record: HealthRecord): Promise<void>;
  update(record: HealthRecord): Promise<void>;
  findById(id: string): Promise<HealthRecord | null>;
  list(limit?: number, offset?: number): Promise<HealthRecord[]>;
  delete(id: string): Promise<boolean>;
}

const HEALTH_RECORD_COLUMNS = 'id, title, content, recorded_on, created_at, updated_at';

export class SqliteHealthRecordRepository implements HealthRecordRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insert(record: HealthRecord): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO health_records (id, title, content, recorded_on, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [record.id, record.title, record.content, record.recordedOn, record.createdAt, record.updatedAt],
    );
  }

  async update(record: HealthRecord): Promise<void> {
    await this.db.runAsync(
      `UPDATE health_records SET title = ?, content = ?, recorded_on = ?, updated_at = ?
        WHERE id = ?`,
      [record.title, record.content, record.recordedOn, record.updatedAt, record.id],
    );
  }

  async findById(id: string): Promise<HealthRecord | null> {
    const row = await this.db.getFirstAsync<HealthRecordRow>(
      `SELECT ${HEALTH_RECORD_COLUMNS} FROM health_records WHERE id = ?`,
      [id],
    );
    return row ? mapHealthRecordRow(row) : null;
  }

  async list(limit = 50, offset = 0): Promise<HealthRecord[]> {
    const rows = await this.db.getAllAsync<HealthRecordRow>(
      `SELECT ${HEALTH_RECORD_COLUMNS} FROM health_records
       ORDER BY recorded_on ASC, created_at ASC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return rows.map(mapHealthRecordRow);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.runAsync('DELETE FROM health_records WHERE id = ?', [id]);
    return result.changes > 0;
  }
}
