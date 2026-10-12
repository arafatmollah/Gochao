/**
 * Health & medicine domain types (master prompt Module H).
 *
 * Recordkeeping only: every clinical-looking field (strength, dosage,
 * frequency, schedule) is stored exactly as the user enters it. Dates are
 * calendar `YYYY-MM-DD` days; schedule times are local wall-clock `HH:mm`.
 */

export const MEDICINE_FREQUENCIES = ['daily', 'weekly', 'as_needed'] as const;
export type MedicineFrequency = (typeof MEDICINE_FREQUENCIES)[number];

export const DOSE_STATUSES = ['taken', 'skipped'] as const;
export type DoseStatus = (typeof DOSE_STATUSES)[number];

/** ISO weekday numbers as strings: Monday (`1`) through Sunday (`7`). */
export const WEEKDAYS = ['1', '2', '3', '4', '5', '6', '7'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const MEDICINE_NAME_MAX_LENGTH = 120;
export const MEDICINE_STRENGTH_MAX_LENGTH = 60;
export const MEDICINE_DOSAGE_MAX_LENGTH = 200;
export const MEDICINE_PRESCRIBER_MAX_LENGTH = 120;
export const MEDICINE_NOTES_MAX_LENGTH = 2000;
export const APPOINTMENT_TITLE_MAX_LENGTH = 140;
export const APPOINTMENT_DOCTOR_MAX_LENGTH = 120;
export const APPOINTMENT_PLACE_MAX_LENGTH = 140;
export const APPOINTMENT_NOTES_MAX_LENGTH = 2000;
export const HEALTH_RECORD_TITLE_MAX_LENGTH = 140;
export const HEALTH_RECORD_CONTENT_MAX_LENGTH = 10000;

export interface Medicine {
  id: string;
  name: string;
  strength: string | null;
  /** Dosage instructions exactly as entered by the user. */
  dosage: string | null;
  frequency: MedicineFrequency;
  /** First day the course applies, or null when open-ended. */
  startDate: string | null;
  /** Last day the course applies, or null when open-ended. */
  endDate: string | null;
  /** Prescriber or source of instructions, as entered. */
  prescriber: string | null;
  notes: string | null;
  isArchived: boolean;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
}

export interface MedicineSchedule {
  id: string;
  medicineId: string;
  /** Local wall-clock `HH:mm` (24-hour). */
  time: string;
  /** ISO weekday numbers that apply, or null for every day. */
  weekdays: Weekday[] | null;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
}

export interface MedicineWithSchedules extends Medicine {
  schedules: MedicineSchedule[];
}

export interface DoseLog {
  scheduleId: string;
  date: string;
  status: DoseStatus;
  /** ISO-8601 UTC timestamp of when the status was recorded. */
  loggedAt: string;
  /** ISO-8601 UTC timestamp of the last change. */
  updatedAt: string;
}

/** One checklist entry: a schedule due on a day, plus its log if any. */
export interface DueDose {
  scheduleId: string;
  medicineId: string;
  medicineName: string;
  dosage: string | null;
  time: string;
  date: string;
  status: DoseStatus | null;
}

export interface CreateMedicineInput {
  name: string;
  strength?: string | null;
  dosage?: string | null;
  frequency?: MedicineFrequency;
  startDate?: string | null;
  endDate?: string | null;
  prescriber?: string | null;
  notes?: string | null;
  schedules?: CreateScheduleInput[];
}

export interface UpdateMedicineInput {
  name?: string;
  strength?: string | null;
  dosage?: string | null;
  frequency?: MedicineFrequency;
  startDate?: string | null;
  endDate?: string | null;
  prescriber?: string | null;
  notes?: string | null;
  /** Full replacement set; existing rows matched by id keep their logs. */
  schedules?: UpdateScheduleInput[];
}

export interface CreateScheduleInput {
  time: string;
  weekdays?: Weekday[] | null;
}

export interface UpdateScheduleInput {
  /** Omitted id means "new row". Unknown ids are rejected. */
  id?: string;
  time: string;
  weekdays?: Weekday[] | null;
}

export interface MedicineFilter {
  archived?: boolean;
  /** Case-insensitive substring match on medicine name. */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface Appointment {
  id: string;
  title: string;
  doctor: string | null;
  place: string | null;
  date: string;
  time: string | null;
  notes: string | null;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
}

export interface CreateAppointmentInput {
  title: string;
  doctor?: string | null;
  place?: string | null;
  date: string;
  time?: string | null;
  notes?: string | null;
}

export interface UpdateAppointmentInput {
  title?: string;
  doctor?: string | null;
  place?: string | null;
  date?: string;
  time?: string | null;
  notes?: string | null;
}

export interface HealthRecord {
  id: string;
  title: string;
  content: string | null;
  recordedOn: string;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
}

export interface CreateHealthRecordInput {
  title: string;
  content?: string | null;
  recordedOn?: string;
}

export interface UpdateHealthRecordInput {
  title?: string;
  content?: string | null;
  recordedOn?: string;
}
