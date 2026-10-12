import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteAppointmentRepository } from '@/db/repositories/health-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createAppointmentService } from '@/services/appointment-service';
import {
  validateAppointmentDate,
  validateAppointmentDoctor,
  validateAppointmentNotes,
  validateAppointmentPlace,
  validateAppointmentTitle,
  validateOptionalWallClockTime,
} from '@/services/health-validation';
import {
  APPOINTMENT_DOCTOR_MAX_LENGTH,
  APPOINTMENT_NOTES_MAX_LENGTH,
  APPOINTMENT_PLACE_MAX_LENGTH,
  APPOINTMENT_TITLE_MAX_LENGTH,
} from '@/types/health';

export interface UseAppointmentFormResult {
  isEdit: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;

  title: string;
  setTitle: (value: string) => void;
  /** Validation code (see `health-validation`); translate before rendering. */
  titleError: string | null;
  doctor: string;
  setDoctor: (value: string) => void;
  doctorError: string | null;
  place: string;
  setPlace: (value: string) => void;
  placeError: string | null;
  date: string;
  setDate: (value: string) => void;
  dateError: string | null;
  time: string;
  setTime: (value: string) => void;
  timeError: string | null;
  notes: string;
  setNotes: (value: string) => void;
  notesError: string | null;

  formError: string | null;
  saving: boolean;
  deleting: boolean;
  submit: () => Promise<boolean>;
  remove: () => Promise<boolean>;
}

export function useAppointmentForm(appointmentId?: string): UseAppointmentFormResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createAppointmentService(new SqliteAppointmentRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();
  const isEdit = appointmentId !== undefined;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [title, setTitle] = useState('');
  const [doctor, setDoctor] = useState('');
  const [place, setPlace] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');

  const [titleError, setTitleError] = useState<string | null>(null);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEdit || !appointmentId) {
      return;
    }
    let active = true;
    service
      .getById(appointmentId)
      .then((appointment) => {
        if (!active) return;
        setTitle(appointment.title);
        setDoctor(appointment.doctor ?? '');
        setPlace(appointment.place ?? '');
        setDate(appointment.date);
        setTime(appointment.time ?? '');
        setNotes(appointment.notes ?? '');
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
  }, [isEdit, appointmentId, service, reloadKey, t]);

  const validate = useCallback((): boolean => {
    const titleValidation = validateAppointmentTitle(title);
    const doctorValidation = validateAppointmentDoctor(doctor);
    const placeValidation = validateAppointmentPlace(place);
    const dateValidation = validateAppointmentDate(date);
    const timeValidation = validateOptionalWallClockTime(time === '' ? null : time);
    const notesValidation = validateAppointmentNotes(notes);
    setTitleError(titleValidation);
    setDoctorError(doctorValidation);
    setPlaceError(placeValidation);
    setDateError(dateValidation);
    setTimeError(timeValidation);
    setNotesError(notesValidation);
    return (
      titleValidation === null &&
      doctorValidation === null &&
      placeValidation === null &&
      dateValidation === null &&
      timeValidation === null &&
      notesValidation === null
    );
  }, [title, doctor, place, date, time, notes]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (saving || deleting) {
      return false;
    }
    setFormError(null);
    if (!validate()) {
      return false;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        doctor,
        place,
        date,
        time: time === '' ? null : time,
        notes,
      };
      if (isEdit && appointmentId) {
        await service.update(appointmentId, payload);
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
  }, [saving, deleting, validate, isEdit, appointmentId, service, title, doctor, place, date, time, notes, t]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !appointmentId || saving || deleting) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await service.remove(appointmentId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, appointmentId, saving, deleting, service, t]);

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
    title,
    setTitle: (value) => {
      setTitle(value);
      if (titleError) setTitleError(null);
    },
    titleError,
    doctor,
    setDoctor: (value) => {
      setDoctor(value);
      if (doctorError) setDoctorError(null);
    },
    doctorError,
    place,
    setPlace: (value) => {
      setPlace(value);
      if (placeError) setPlaceError(null);
    },
    placeError,
    date,
    setDate: (value) => {
      setDate(value);
      if (dateError) setDateError(null);
    },
    dateError,
    time,
    setTime: (value) => {
      setTime(value);
      if (timeError) setTimeError(null);
    },
    timeError,
    notes,
    setNotes: (value) => {
      setNotes(value);
      if (notesError) setNotesError(null);
    },
    notesError,
    formError,
    saving,
    deleting,
    submit,
    remove,
  };
}

export {
  APPOINTMENT_DOCTOR_MAX_LENGTH,
  APPOINTMENT_NOTES_MAX_LENGTH,
  APPOINTMENT_PLACE_MAX_LENGTH,
  APPOINTMENT_TITLE_MAX_LENGTH,
};
