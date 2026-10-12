import {
  APPOINTMENT_DOCTOR_MAX_LENGTH,
  APPOINTMENT_NOTES_MAX_LENGTH,
  APPOINTMENT_PLACE_MAX_LENGTH,
  APPOINTMENT_TITLE_MAX_LENGTH,
  HEALTH_RECORD_CONTENT_MAX_LENGTH,
  HEALTH_RECORD_TITLE_MAX_LENGTH,
  MEDICINE_DOSAGE_MAX_LENGTH,
  MEDICINE_FREQUENCIES,
  MEDICINE_NAME_MAX_LENGTH,
  MEDICINE_NOTES_MAX_LENGTH,
  MEDICINE_PRESCRIBER_MAX_LENGTH,
  MEDICINE_STRENGTH_MAX_LENGTH,
  WEEKDAYS,
} from '@/types/health';
import { isValidIsoDate } from '@/utils/dates';

/**
 * Shared health validation rules, used both by the forms (field-level
 * feedback) and by the services (authoritative check before persisting).
 *
 * Validators return a stable machine-readable code (or null when valid).
 * The UI translates codes into localized copy via `translateValidationCode`;
 * services wrap them in `AppError('validation', code)`.
 */

export type HealthValidationCode =
  | 'medicine_name_required'
  | 'medicine_name_too_long'
  | 'medicine_strength_too_long'
  | 'medicine_dosage_too_long'
  | 'medicine_frequency_invalid'
  | 'medicine_date_invalid'
  | 'medicine_end_before_start'
  | 'medicine_prescriber_too_long'
  | 'medicine_notes_too_long'
  | 'medicine_time_required'
  | 'medicine_time_invalid'
  | 'medicine_weekdays_invalid'
  | 'medicine_schedule_unknown'
  | 'dose_status_invalid'
  | 'appointment_title_required'
  | 'appointment_title_too_long'
  | 'appointment_doctor_too_long'
  | 'appointment_place_too_long'
  | 'appointment_date_invalid'
  | 'appointment_time_invalid'
  | 'appointment_notes_too_long'
  | 'health_record_title_required'
  | 'health_record_title_too_long'
  | 'health_record_content_too_long'
  | 'health_record_date_invalid';

export function validateMedicineName(name: string): HealthValidationCode | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'medicine_name_required';
  }
  if (trimmed.length > MEDICINE_NAME_MAX_LENGTH) {
    return 'medicine_name_too_long';
  }
  return null;
}

function validateOptionalText(
  value: string | null | undefined,
  maxLength: number,
  tooLong: HealthValidationCode,
): HealthValidationCode | null {
  if (value == null || value.trim() === '') {
    return null;
  }
  if (value.trim().length > maxLength) {
    return tooLong;
  }
  return null;
}

export function validateMedicineStrength(
  strength: string | null | undefined,
): HealthValidationCode | null {
  return validateOptionalText(strength, MEDICINE_STRENGTH_MAX_LENGTH, 'medicine_strength_too_long');
}

export function validateMedicineDosage(
  dosage: string | null | undefined,
): HealthValidationCode | null {
  return validateOptionalText(dosage, MEDICINE_DOSAGE_MAX_LENGTH, 'medicine_dosage_too_long');
}

export function validateMedicineFrequency(frequency: string): HealthValidationCode | null {
  if (!(MEDICINE_FREQUENCIES as readonly string[]).includes(frequency)) {
    return 'medicine_frequency_invalid';
  }
  return null;
}

export function validateMedicineDate(
  date: string | null | undefined,
): HealthValidationCode | null {
  if (date == null || date === '') {
    return null;
  }
  if (!isValidIsoDate(date)) {
    return 'medicine_date_invalid';
  }
  return null;
}

export function validateMedicinePrescriber(
  prescriber: string | null | undefined,
): HealthValidationCode | null {
  return validateOptionalText(
    prescriber,
    MEDICINE_PRESCRIBER_MAX_LENGTH,
    'medicine_prescriber_too_long',
  );
}

export function validateMedicineNotes(
  notes: string | null | undefined,
): HealthValidationCode | null {
  return validateOptionalText(notes, MEDICINE_NOTES_MAX_LENGTH, 'medicine_notes_too_long');
}

const WALL_CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateWallClockTime(
  time: string | null | undefined,
): HealthValidationCode | null {
  if (time == null || time.trim() === '') {
    return 'medicine_time_required';
  }
  if (!WALL_CLOCK_PATTERN.test(time.trim())) {
    return 'medicine_time_invalid';
  }
  return null;
}

export function validateOptionalWallClockTime(
  time: string | null | undefined,
): HealthValidationCode | null {
  if (time == null || time.trim() === '') {
    return null;
  }
  if (!WALL_CLOCK_PATTERN.test(time.trim())) {
    return 'appointment_time_invalid';
  }
  return null;
}

export function validateWeekdays(weekdays: unknown): HealthValidationCode | null {
  if (weekdays === null || weekdays === undefined) {
    return null;
  }
  if (!Array.isArray(weekdays) || weekdays.length === 0 || weekdays.length > 7) {
    return 'medicine_weekdays_invalid';
  }
  const known = WEEKDAYS as readonly string[];
  if (!weekdays.every((day) => typeof day === 'string' && known.includes(day))) {
    return 'medicine_weekdays_invalid';
  }
  if (new Set(weekdays).size !== weekdays.length) {
    return 'medicine_weekdays_invalid';
  }
  return null;
}

export function validateAppointmentTitle(title: string): HealthValidationCode | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return 'appointment_title_required';
  }
  if (trimmed.length > APPOINTMENT_TITLE_MAX_LENGTH) {
    return 'appointment_title_too_long';
  }
  return null;
}

export function validateAppointmentDoctor(
  doctor: string | null | undefined,
): HealthValidationCode | null {
  return validateOptionalText(doctor, APPOINTMENT_DOCTOR_MAX_LENGTH, 'appointment_doctor_too_long');
}

export function validateAppointmentPlace(
  place: string | null | undefined,
): HealthValidationCode | null {
  return validateOptionalText(place, APPOINTMENT_PLACE_MAX_LENGTH, 'appointment_place_too_long');
}

export function validateAppointmentDate(date: string): HealthValidationCode | null {
  if (!isValidIsoDate(date)) {
    return 'appointment_date_invalid';
  }
  return null;
}

export function validateAppointmentNotes(
  notes: string | null | undefined,
): HealthValidationCode | null {
  return validateOptionalText(notes, APPOINTMENT_NOTES_MAX_LENGTH, 'appointment_notes_too_long');
}

export function validateHealthRecordTitle(title: string): HealthValidationCode | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return 'health_record_title_required';
  }
  if (trimmed.length > HEALTH_RECORD_TITLE_MAX_LENGTH) {
    return 'health_record_title_too_long';
  }
  return null;
}

export function validateHealthRecordContent(
  content: string | null | undefined,
): HealthValidationCode | null {
  if (content && content.trim().length > HEALTH_RECORD_CONTENT_MAX_LENGTH) {
    return 'health_record_content_too_long';
  }
  return null;
}

export function validateHealthRecordDate(date: string): HealthValidationCode | null {
  if (!isValidIsoDate(date)) {
    return 'health_record_date_invalid';
  }
  return null;
}
