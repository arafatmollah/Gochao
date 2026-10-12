import type { AppointmentRepository } from '@/db/repositories/health-repository';
import type {
  Appointment,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '@/types/health';
import { AppError } from '@/utils/errors';
import { newId } from '@/utils/id';
import { nowIso } from '@/utils/time';

import type { HealthValidationCode } from './health-validation';
import {
  validateAppointmentDate,
  validateAppointmentDoctor,
  validateAppointmentNotes,
  validateAppointmentPlace,
  validateAppointmentTitle,
  validateOptionalWallClockTime,
} from './health-validation';

export interface AppointmentServiceDeps {
  /** Injectable clock for deterministic tests; defaults to ISO-8601 UTC now. */
  now?: () => string;
  /** Injectable ID generator; defaults to a random v4 UUID. */
  generateId?: () => string;
}

export interface AppointmentService {
  listUpcoming(fromDate: string, limit?: number): Promise<Appointment[]>;
  listPast(fromDate: string, limit?: number): Promise<Appointment[]>;
  getById(id: string): Promise<Appointment>;
  create(input: CreateAppointmentInput): Promise<Appointment>;
  update(id: string, input: UpdateAppointmentInput): Promise<Appointment>;
  remove(id: string): Promise<void>;
}

/** Wraps unexpected storage failures; never leaks SQL or record contents. */
function databaseError(cause: unknown): AppError {
  return new AppError('database', 'Could not access the database. Please try again.', { cause });
}

function notFoundError(): AppError {
  return new AppError('not_found', 'This appointment no longer exists.');
}

function validationError(code: HealthValidationCode): AppError {
  return new AppError('validation', code);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function createAppointmentService(
  repo: AppointmentRepository,
  deps: AppointmentServiceDeps = {},
): AppointmentService {
  const now = deps.now ?? nowIso;
  const generateId = deps.generateId ?? newId;

  async function loadExisting(id: string): Promise<Appointment> {
    const appointment = await repo.findById(id);
    if (!appointment) {
      throw notFoundError();
    }
    return appointment;
  }

  function assertValidFields(input: {
    title: string;
    doctor: string | null | undefined;
    place: string | null | undefined;
    date: string;
    time: string | null | undefined;
    notes: string | null | undefined;
  }): void {
    const titleError = validateAppointmentTitle(input.title);
    if (titleError) {
      throw validationError(titleError);
    }
    const doctorError = validateAppointmentDoctor(input.doctor);
    if (doctorError) {
      throw validationError(doctorError);
    }
    const placeError = validateAppointmentPlace(input.place);
    if (placeError) {
      throw validationError(placeError);
    }
    const dateError = validateAppointmentDate(input.date);
    if (dateError) {
      throw validationError(dateError);
    }
    const timeError = validateOptionalWallClockTime(input.time);
    if (timeError) {
      throw validationError(timeError);
    }
    const notesError = validateAppointmentNotes(input.notes);
    if (notesError) {
      throw validationError(notesError);
    }
  }

  return {
    async listUpcoming(fromDate: string, limit?: number): Promise<Appointment[]> {
      try {
        return await repo.listUpcoming(fromDate, limit);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async listPast(fromDate: string, limit?: number): Promise<Appointment[]> {
      try {
        return await repo.listPast(fromDate, limit);
      } catch (error) {
        throw databaseError(error);
      }
    },

    async getById(id: string): Promise<Appointment> {
      try {
        return await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError && error.code === 'not_found') {
          throw error;
        }
        throw databaseError(error);
      }
    },

    async create(input: CreateAppointmentInput): Promise<Appointment> {
      assertValidFields({
        title: input.title,
        doctor: input.doctor,
        place: input.place,
        date: input.date,
        time: input.time,
        notes: input.notes,
      });

      const timestamp = now();
      const appointment: Appointment = {
        id: generateId(),
        title: input.title.trim(),
        doctor: normalizeOptionalText(input.doctor),
        place: normalizeOptionalText(input.place),
        date: input.date,
        time: normalizeOptionalText(input.time),
        notes: normalizeOptionalText(input.notes),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await repo.insert(appointment);
      } catch (error) {
        throw databaseError(error);
      }
      return appointment;
    },

    async update(id: string, input: UpdateAppointmentInput): Promise<Appointment> {
      let existing: Appointment;
      try {
        existing = await loadExisting(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw databaseError(error);
      }

      const title = input.title === undefined ? existing.title : input.title;
      const doctor = input.doctor === undefined ? existing.doctor : input.doctor;
      const place = input.place === undefined ? existing.place : input.place;
      const date = input.date === undefined ? existing.date : input.date;
      const time = input.time === undefined ? existing.time : input.time;
      const notes = input.notes === undefined ? existing.notes : input.notes;
      assertValidFields({ title, doctor, place, date, time, notes });

      const updated: Appointment = {
        ...existing,
        title: title.trim(),
        doctor: normalizeOptionalText(doctor),
        place: normalizeOptionalText(place),
        date,
        time: normalizeOptionalText(time),
        notes: normalizeOptionalText(notes),
        updatedAt: now(),
      };

      try {
        await repo.update(updated);
      } catch (error) {
        throw databaseError(error);
      }
      return updated;
    },

    async remove(id: string): Promise<void> {
      let deleted: boolean;
      try {
        deleted = await repo.delete(id);
      } catch (error) {
        throw databaseError(error);
      }
      if (!deleted) {
        throw notFoundError();
      }
    },
  };
}
