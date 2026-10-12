import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteMedicineRepository } from '@/db/repositories/health-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createMedicineService } from '@/services/medicine-service';
import {
  validateMedicineDate,
  validateMedicineDosage,
  validateMedicineName,
  validateMedicineNotes,
  validateMedicinePrescriber,
  validateMedicineStrength,
  validateWallClockTime,
} from '@/services/health-validation';
import {
  MEDICINE_DOSAGE_MAX_LENGTH,
  MEDICINE_NAME_MAX_LENGTH,
  MEDICINE_NOTES_MAX_LENGTH,
  MEDICINE_PRESCRIBER_MAX_LENGTH,
  MEDICINE_STRENGTH_MAX_LENGTH,
  WEEKDAYS,
  type MedicineFrequency,
  type Weekday,
} from '@/types/health';

export interface MedicineScheduleDraft {
  key: string;
  time: string;
  weekdays: Weekday[];
  /** Database id when editing an existing row; undefined for new rows. */
  id?: string;
}

export interface UseMedicineFormResult {
  isEdit: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;
  isArchived: boolean;

  name: string;
  setName: (value: string) => void;
  /** Validation code (see `health-validation`); translate before rendering. */
  nameError: string | null;
  strength: string;
  setStrength: (value: string) => void;
  strengthError: string | null;
  dosage: string;
  setDosage: (value: string) => void;
  dosageError: string | null;
  frequency: MedicineFrequency;
  setFrequency: (value: MedicineFrequency) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  dateError: string | null;
  endDate: string;
  setEndDate: (value: string) => void;
  prescriber: string;
  setPrescriber: (value: string) => void;
  prescriberError: string | null;
  notes: string;
  setNotes: (value: string) => void;
  notesError: string | null;

  schedules: MedicineScheduleDraft[];
  setScheduleTime: (key: string, time: string) => void;
  toggleScheduleWeekday: (key: string, weekday: Weekday) => void;
  setScheduleEveryDay: (key: string) => void;
  addSchedule: () => void;
  removeSchedule: (key: string) => void;
  /** Validation code for the schedule list as a whole. */
  schedulesError: string | null;

  formError: string | null;
  saving: boolean;
  deleting: boolean;
  archiving: boolean;
  submit: () => Promise<boolean>;
  remove: () => Promise<boolean>;
  toggleArchived: () => Promise<boolean>;
}

let draftKey = 0;
function newDraftKey(): string {
  draftKey += 1;
  return `draft-${draftKey}`;
}

function toDraftWeekdays(weekdays: Weekday[] | null): Weekday[] {
  return weekdays === null ? [...WEEKDAYS] : [...weekdays];
}

export function useMedicineForm(medicineId?: string): UseMedicineFormResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createMedicineService(new SqliteMedicineRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();
  const isEdit = medicineId !== undefined;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isArchived, setIsArchived] = useState(false);

  const [name, setName] = useState('');
  const [strength, setStrength] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequencyState] = useState<MedicineFrequency>('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [prescriber, setPrescriber] = useState('');
  const [notes, setNotes] = useState('');
  const [schedules, setSchedules] = useState<MedicineScheduleDraft[]>([
    { key: newDraftKey(), time: '08:00', weekdays: [...WEEKDAYS] },
  ]);

  const [nameError, setNameError] = useState<string | null>(null);
  const [strengthError, setStrengthError] = useState<string | null>(null);
  const [dosageError, setDosageError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [prescriberError, setPrescriberError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [schedulesError, setSchedulesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!isEdit || !medicineId) {
      return;
    }
    let active = true;
    service
      .getById(medicineId)
      .then((medicine) => {
        if (!active) return;
        setName(medicine.name);
        setStrength(medicine.strength ?? '');
        setDosage(medicine.dosage ?? '');
        setFrequencyState(medicine.frequency);
        setStartDate(medicine.startDate ?? '');
        setEndDate(medicine.endDate ?? '');
        setPrescriber(medicine.prescriber ?? '');
        setNotes(medicine.notes ?? '');
        setIsArchived(medicine.isArchived);
        setSchedules(
          medicine.schedules.map((schedule) => ({
            key: newDraftKey(),
            id: schedule.id,
            time: schedule.time,
            weekdays: toDraftWeekdays(schedule.weekdays),
          })),
        );
        setLoadError(null);
        setLoadState('ready');
      })
      .catch((loadFailure: unknown) => {
        if (!active) return;
        setLoadError(translateError(loadFailure, t));
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [isEdit, medicineId, service, reloadKey, t]);

  const setFrequency = useCallback((value: MedicineFrequency) => {
    setFrequencyState(value);
    if (value === 'as_needed') {
      setSchedules([]);
      setSchedulesError(null);
    } else if (schedules.length === 0) {
      setSchedules([{ key: newDraftKey(), time: '08:00', weekdays: [...WEEKDAYS] }]);
    }
  }, [schedules.length]);

  const setScheduleTime = useCallback(
    (key: string, time: string) => {
      setSchedules((current) =>
        current.map((draft) => (draft.key === key ? { ...draft, time } : draft)),
      );
      if (schedulesError) setSchedulesError(null);
    },
    [schedulesError],
  );

  const toggleScheduleWeekday = useCallback(
    (key: string, weekday: Weekday) => {
      setSchedules((current) =>
        current.map((draft) => {
          if (draft.key !== key) {
            return draft;
          }
          const has = draft.weekdays.includes(weekday);
          const next =
            has && draft.weekdays.length === 1
              ? draft.weekdays
              : has
                ? draft.weekdays.filter((day) => day !== weekday)
                : [...draft.weekdays, weekday].sort();
          return { ...draft, weekdays: next as Weekday[] };
        }),
      );
      if (schedulesError) setSchedulesError(null);
    },
    [schedulesError],
  );

  const setScheduleEveryDay = useCallback((key: string) => {
    setSchedules((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, weekdays: [...WEEKDAYS] } : draft)),
    );
  }, []);

  const addSchedule = useCallback(() => {
    setSchedules((current) => [
      ...current,
      { key: newDraftKey(), time: '08:00', weekdays: [...WEEKDAYS] },
    ]);
    if (schedulesError) setSchedulesError(null);
  }, [schedulesError]);

  const removeSchedule = useCallback((key: string) => {
    setSchedules((current) => current.filter((draft) => draft.key !== key));
  }, []);

  const validate = useCallback((): boolean => {
    const nameValidation = validateMedicineName(name);
    const strengthValidation = validateMedicineStrength(strength);
    const dosageValidation = validateMedicineDosage(dosage);
    const startValidation = validateMedicineDate(startDate === '' ? null : startDate);
    const endValidation = validateMedicineDate(endDate === '' ? null : endDate);
    const prescriberValidation = validateMedicinePrescriber(prescriber);
    const notesValidation = validateMedicineNotes(notes);
    setNameError(nameValidation);
    setStrengthError(strengthValidation);
    setDosageError(dosageValidation);
    setPrescriberError(prescriberValidation);
    setNotesError(notesValidation);

    let dateValidation: string | null = startValidation ?? endValidation;
    if (dateValidation === null && startDate !== '' && endDate !== '' && endDate < startDate) {
      dateValidation = 'medicine_end_before_start';
    }
    setDateError(dateValidation);

    let scheduleValidation: string | null = null;
    if (frequency === 'as_needed') {
      if (schedules.length > 0) {
        scheduleValidation = 'medicine_time_invalid';
      }
    } else if (schedules.length === 0) {
      scheduleValidation = 'medicine_time_required';
    } else {
      for (const draft of schedules) {
        const timeValidation = validateWallClockTime(draft.time);
        if (timeValidation) {
          scheduleValidation = timeValidation;
          break;
        }
        if (frequency === 'weekly' && draft.weekdays.length === 0) {
          scheduleValidation = 'medicine_weekdays_invalid';
          break;
        }
      }
    }
    setSchedulesError(scheduleValidation);

    return (
      nameValidation === null &&
      strengthValidation === null &&
      dosageValidation === null &&
      dateValidation === null &&
      prescriberValidation === null &&
      notesValidation === null &&
      scheduleValidation === null
    );
  }, [name, strength, dosage, frequency, startDate, endDate, prescriber, notes, schedules]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (saving || deleting || archiving) {
      return false;
    }
    setFormError(null);
    if (!validate()) {
      return false;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        strength,
        dosage,
        frequency,
        startDate: startDate === '' ? null : startDate,
        endDate: endDate === '' ? null : endDate,
        prescriber,
        notes,
        schedules: schedules.map((draft) => ({
          id: draft.id,
          time: draft.time.trim(),
          weekdays: draft.weekdays.length === WEEKDAYS.length ? null : draft.weekdays,
        })),
      };
      if (isEdit && medicineId) {
        await service.update(medicineId, payload);
      } else {
        await service.create(payload);
      }
      return true;
    } catch (submitError) {
      setFormError(translateError(submitError, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    deleting,
    archiving,
    validate,
    isEdit,
    medicineId,
    service,
    name,
    strength,
    dosage,
    frequency,
    startDate,
    endDate,
    prescriber,
    notes,
    schedules,
    t,
  ]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !medicineId || saving || deleting || archiving) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await service.remove(medicineId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, medicineId, saving, deleting, archiving, service, t]);

  const toggleArchived = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !medicineId || saving || deleting || archiving) {
      return false;
    }
    setFormError(null);
    setArchiving(true);
    try {
      const updated = await service.setArchived(medicineId, !isArchived);
      setIsArchived(updated.isArchived);
      return true;
    } catch (archiveError) {
      setFormError(translateError(archiveError, t));
      return false;
    } finally {
      setArchiving(false);
    }
  }, [isEdit, medicineId, saving, deleting, archiving, service, isArchived, t]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoadState('loading');
    setReloadKey((key) => key + 1);
  }, []);

  return {
    isEdit,
    loadState,
    loadError,
    retryLoad,
    isArchived,
    name,
    setName: (value) => {
      setName(value);
      if (nameError) setNameError(null);
    },
    nameError,
    strength,
    setStrength: (value) => {
      setStrength(value);
      if (strengthError) setStrengthError(null);
    },
    strengthError,
    dosage,
    setDosage: (value) => {
      setDosage(value);
      if (dosageError) setDosageError(null);
    },
    dosageError,
    frequency,
    setFrequency,
    startDate,
    setStartDate: (value) => {
      setStartDate(value);
      if (dateError) setDateError(null);
    },
    dateError,
    endDate,
    setEndDate: (value) => {
      setEndDate(value);
      if (dateError) setDateError(null);
    },
    prescriber,
    setPrescriber: (value) => {
      setPrescriber(value);
      if (prescriberError) setPrescriberError(null);
    },
    prescriberError,
    notes,
    setNotes: (value) => {
      setNotes(value);
      if (notesError) setNotesError(null);
    },
    notesError,
    schedules,
    setScheduleTime,
    toggleScheduleWeekday,
    setScheduleEveryDay,
    addSchedule,
    removeSchedule,
    schedulesError,
    formError,
    saving,
    deleting,
    archiving,
    submit,
    remove,
    toggleArchived,
  };
}

export {
  MEDICINE_DOSAGE_MAX_LENGTH,
  MEDICINE_NAME_MAX_LENGTH,
  MEDICINE_NOTES_MAX_LENGTH,
  MEDICINE_PRESCRIBER_MAX_LENGTH,
  MEDICINE_STRENGTH_MAX_LENGTH,
};
