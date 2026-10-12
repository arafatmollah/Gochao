import type { MedicineRepository } from '@/db/repositories/health-repository';
import type {
  CreateMedicineInput,
  DoseLog,
  DoseStatus,
  DueDose,
  Medicine,
  MedicineFilter,
  MedicineFrequency,
  MedicineSchedule,
  MedicineWithSchedules,
  UpdateMedicineInput,
  UpdateScheduleInput,
  Weekday,
} from '@/types/health';
import { DOSE_STATUSES } from '@/types/health';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import type { HealthValidationCode } from './health-validation';
import {
  validateMedicineDate,
  validateMedicineDosage,
  validateMedicineFrequency,
  validateMedicineName,
  validateMedicineNotes,
  validateMedicinePrescriber,
  validateMedicineStrength,
  validateWallClockTime,
  validateWeekdays,
} from './health-validation';

export interface MedicineServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface MedicineService {
  list(filter?: MedicineFilter): Promise<MedicineWithSchedules[]>;
  getById(id: string): Promise<MedicineWithSchedules>;
  create(input: CreateMedicineInput): Promise<MedicineWithSchedules>;
  update(id: string, input: UpdateMedicineInput): Promise<MedicineWithSchedules>;
  /** Archives (or unarchives) a medicine. Archived medicines leave the checklist. */
  setArchived(id: string, archived: boolean): Promise<MedicineWithSchedules>;
  remove(id: string): Promise<void>;

  /** Checklist entries due on a date, earliest first. */
  listDueDoses(date: string): Promise<DueDose[]>;
  /** Records a dose as taken or skipped (upsert, idempotent). */
  logDose(scheduleId: string, date: string, status: DoseStatus): Promise<DoseLog>;
  /** Clears a dose log; absence afterwards means "not recorded". */
  clearDose(scheduleId: string, date: string): Promise<boolean>;
  /** Taken/total log counts per medicine since (and including) a date. */
  adherenceSince(
    sinceDate: string,
  ): Promise<{ medicineId: string; taken: number; total: number }[]>;
}

/** Wraps unexpected storage failures; never leaks SQL or record contents. */
function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This medicine no longer exists.');
}

function validationError(code: HealthValidationCode): AppError {
  return new AppError('validation', code);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeWeekdays(weekdays: Weekday[] | null | undefined): Weekday[] | null {
  if (weekdays === null || weekdays === undefined) {
    return null;
  }
  return [...new Set(weekdays)].sort() as Weekday[];
}

export function createMedicineService(
  repo: MedicineRepository,
  deps: MedicineServiceDeps = {},
): MedicineService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<MedicineWithSchedules> {
    const medicine = await repo.findMedicineById(id);
    if (!medicine) {
      throw notFoundError();
    }
    return medicine;
  }

  function assertValidMedicineFields(input: {
    name: string;
    strength: string | null | undefined;
    dosage: string | null | undefined;
    frequency: MedicineFrequency;
    startDate: string | null | undefined;
    endDate: string | null | undefined;
    prescriber: string | null | undefined;
    notes: string | null | undefined;
  }): void {
    const nameError = validateMedicineName(input.name);
    if (nameError) {
      throw validationError(nameError);
    }
    const strengthError = validateMedicineStrength(input.strength);
    if (strengthError) {
      throw validationError(strengthError);
    }
    const dosageError = validateMedicineDosage(input.dosage);
    if (dosageError) {
      throw validationError(dosageError);
    }
    const frequencyError = validateMedicineFrequency(input.frequency);
    if (frequencyError) {
      throw validationError(frequencyError);
    }
    const startError = validateMedicineDate(input.startDate);
    if (startError) {
      throw validationError(startError);
    }
    const endError = validateMedicineDate(input.endDate);
    if (endError) {
      throw validationError(endError);
    }
    const start = normalizeDate(input.startDate);
    const end = normalizeDate(input.endDate);
    if (start && end && end < start) {
      throw validationError('medicine_end_before_start');
    }
    const prescriberError = validateMedicinePrescriber(input.prescriber);
    if (prescriberError) {
      throw validationError(prescriberError);
    }
    const notesError = validateMedicineNotes(input.notes);
    if (notesError) {
      throw validationError(notesError);
    }
  }

  function assertValidSchedules(
    frequency: MedicineFrequency,
    schedules: { time: string; weekdays?: Weekday[] | null }[],
  ): void {
    if (frequency === 'as_needed' && schedules.length > 0) {
      throw validationError('medicine_time_invalid');
    }
    if (frequency !== 'as_needed' && schedules.length === 0) {
      throw validationError('medicine_time_required');
    }
    for (const schedule of schedules) {
      const timeError = validateWallClockTime(schedule.time);
      if (timeError) {
        throw validationError(timeError);
      }
      const weekdaysError = validateWeekdays(schedule.weekdays ?? null);
      if (weekdaysError) {
        throw validationError(weekdaysError);
      }
      if (frequency === 'weekly' && (schedule.weekdays ?? []).length === 0) {
        throw validationError('medicine_weekdays_invalid');
      }
    }
  }

  return {
    async list(filter: MedicineFilter = {}): Promise<MedicineWithSchedules[]> {
      try {
        return await repo.listMedicines(filter);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async getById(id: string): Promise<MedicineWithSchedules> {
      try {
        return await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async create(input: CreateMedicineInput): Promise<MedicineWithSchedules> {
      const frequency = input.frequency ?? 'daily';
      assertValidMedicineFields({
        name: input.name,
        strength: input.strength,
        dosage: input.dosage,
        frequency,
        startDate: input.startDate,
        endDate: input.endDate,
        prescriber: input.prescriber,
        notes: input.notes,
      });
      const schedules = input.schedules ?? [];
      assertValidSchedules(frequency, schedules);

      const timestamp = now();
      const medicine: Medicine = {
        id: generateId(),
        name: input.name.trim(),
        strength: normalizeOptionalText(input.strength),
        dosage: normalizeOptionalText(input.dosage),
        frequency,
        startDate: normalizeDate(input.startDate),
        endDate: normalizeDate(input.endDate),
        prescriber: normalizeOptionalText(input.prescriber),
        notes: normalizeOptionalText(input.notes),
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const rows: MedicineSchedule[] = schedules.map((schedule) => ({
        id: generateId(),
        medicineId: medicine.id,
        time: schedule.time.trim(),
        weekdays: normalizeWeekdays(schedule.weekdays),
        createdAt: timestamp,
      }));

      try {
        await repo.insertMedicine(medicine);
        for (const row of rows) {
          await repo.insertSchedule(row);
        }
      } catch (error) {
        throw databaseError(error);
      }
      return { ...medicine, schedules: rows };
    },

    async update(id: string, input: UpdateMedicineInput): Promise<MedicineWithSchedules> {
      let existing: MedicineWithSchedules;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      const name = input.name === undefined ? existing.name : input.name;
      const frequency = input.frequency ?? existing.frequency;
      const strength = input.strength === undefined ? existing.strength : input.strength;
      const dosage = input.dosage === undefined ? existing.dosage : input.dosage;
      const startDate = input.startDate === undefined ? existing.startDate : input.startDate;
      const endDate = input.endDate === undefined ? existing.endDate : input.endDate;
      const prescriber = input.prescriber === undefined ? existing.prescriber : input.prescriber;
      const notes = input.notes === undefined ? existing.notes : input.notes;

      assertValidMedicineFields({
        name,
        strength,
        dosage,
        frequency,
        startDate,
        endDate,
        prescriber,
        notes,
      });

      const timestamp = now();
      const updated: Medicine = {
        ...existing,
        name: name.trim(),
        strength: normalizeOptionalText(strength),
        dosage: normalizeOptionalText(dosage),
        frequency,
        startDate: normalizeDate(startDate),
        endDate: normalizeDate(endDate),
        prescriber: normalizeOptionalText(prescriber),
        notes: normalizeOptionalText(notes),
        updatedAt: timestamp,
      };

      // Schedule reconciliation: rows matched by id are updated in place
      // (keeping their dose logs); new rows are inserted; rows absent from
      // the replacement set are deleted with their logs.
      let reconciled: MedicineSchedule[] | null = null;
      if (input.schedules !== undefined) {
        assertValidSchedules(frequency, input.schedules);
        try {
          reconciled = await reconcileSchedules(repo, existing, input.schedules, timestamp, generateId);
        } catch (error) {
          if (error instanceof AppError) {
            throw error;
          }
          throw databaseError(error);
        }
      }

      try {
        await repo.updateMedicine(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return { ...updated, schedules: reconciled ?? existing.schedules };
    },

    async setArchived(id: string, archived: boolean): Promise<MedicineWithSchedules> {
      let existing: MedicineWithSchedules;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      if (existing.isArchived === archived) {
        return existing;
      }

      const updated: Medicine = { ...existing, isArchived: archived, updatedAt: now() };
      try {
        await repo.updateMedicine(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return { ...updated, schedules: existing.schedules };
    },

    async remove(id: string): Promise<void> {
      let deleted: boolean;
      try {
        deleted = await repo.deleteMedicine(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (!deleted) {
        throw notFoundError();
      }
    },

    async listDueDoses(date: string): Promise<DueDose[]> {
      try {
        return await repo.listDueDoses(date);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async logDose(scheduleId: string, date: string, status: DoseStatus): Promise<DoseLog> {
      if (!(DOSE_STATUSES as readonly string[]).includes(status)) {
        throw validationError('dose_status_invalid');
      }
      const timestamp = now();
      const log: DoseLog = { scheduleId, date, status, loggedAt: timestamp, updatedAt: timestamp };
      try {
        await repo.upsertLog(log);
      } catch (error) {
        throw databaseError(error);
      }
      return log;
    },

    async clearDose(scheduleId: string, date: string): Promise<boolean> {
      try {
        return await repo.deleteLog(scheduleId, date);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async adherenceSince(
      sinceDate: string,
    ): Promise<{ medicineId: string; taken: number; total: number }[]> {
      try {
        return await repo.countLogsSince(sinceDate);
      } catch (error) {
        throw databaseError(error);
      }
    },
  };
}

async function reconcileSchedules(
  repo: MedicineRepository,
  existing: MedicineWithSchedules,
  replacement: UpdateScheduleInput[],
  timestamp: string,
  generateId: () => string,
): Promise<MedicineSchedule[]> {
  const existingById = new Map(existing.schedules.map((schedule) => [schedule.id, schedule]));
  const seen = new Set<string>();
  const reconciled: MedicineSchedule[] = [];

  for (const entry of replacement) {
    const weekdays = normalizeWeekdays(entry.weekdays);
    if (entry.id === undefined) {
      const created: MedicineSchedule = {
        id: generateId(),
        medicineId: existing.id,
        time: entry.time.trim(),
        weekdays,
        createdAt: timestamp,
      };
      await repo.insertSchedule(created);
      reconciled.push(created);
      continue;
    }
    const current = existingById.get(entry.id);
    if (!current || seen.has(entry.id)) {
      throw validationError('medicine_schedule_unknown');
    }
    seen.add(entry.id);
    const updated: MedicineSchedule = {
      ...current,
      time: entry.time.trim(),
      weekdays,
    };
    await repo.updateSchedule(updated);
    reconciled.push(updated);
  }

  for (const schedule of existing.schedules) {
    if (!seen.has(schedule.id)) {
      await repo.deleteSchedule(schedule.id);
    }
  }

  return reconciled.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}
