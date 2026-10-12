import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteHealthRecordRepository } from '@/db/repositories/health-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createHealthRecordService } from '@/services/health-record-service';
import {
  validateHealthRecordContent,
  validateHealthRecordDate,
  validateHealthRecordTitle,
} from '@/services/health-validation';
import {
  HEALTH_RECORD_CONTENT_MAX_LENGTH,
  HEALTH_RECORD_TITLE_MAX_LENGTH,
} from '@/types/health';
import { todayIsoDate } from '@/utils/dates';

export interface UseHealthNoteFormResult {
  isEdit: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;

  title: string;
  setTitle: (value: string) => void;
  /** Validation code (see `health-validation`); translate before rendering. */
  titleError: string | null;
  content: string;
  setContent: (value: string) => void;
  contentError: string | null;
  recordedOn: string;
  setRecordedOn: (value: string) => void;
  dateError: string | null;

  formError: string | null;
  saving: boolean;
  deleting: boolean;
  submit: () => Promise<boolean>;
  remove: () => Promise<boolean>;
}

export function useHealthNoteForm(recordId?: string): UseHealthNoteFormResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createHealthRecordService(new SqliteHealthRecordRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();
  const isEdit = recordId !== undefined;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [recordedOn, setRecordedOn] = useState(() => todayIsoDate());

  const [titleError, setTitleError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEdit || !recordId) {
      return;
    }
    let active = true;
    service
      .getById(recordId)
      .then((record) => {
        if (!active) return;
        setTitle(record.title);
        setContent(record.content ?? '');
        setRecordedOn(record.recordedOn);
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
  }, [isEdit, recordId, service, reloadKey, t]);

  const validate = useCallback((): boolean => {
    const titleValidation = validateHealthRecordTitle(title);
    const contentValidation = validateHealthRecordContent(content);
    const dateValidation = validateHealthRecordDate(recordedOn);
    setTitleError(titleValidation);
    setContentError(contentValidation);
    setDateError(dateValidation);
    return (
      titleValidation === null && contentValidation === null && dateValidation === null
    );
  }, [title, content, recordedOn]);

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
      if (isEdit && recordId) {
        await service.update(recordId, { title, content, recordedOn });
      } else {
        await service.create({ title, content, recordedOn });
      }
      return true;
    } catch (submitError) {
      setFormError(translateError(submitError, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, deleting, validate, isEdit, recordId, service, title, content, recordedOn, t]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !recordId || saving || deleting) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await service.remove(recordId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, recordId, saving, deleting, service, t]);

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
    content,
    setContent: (value) => {
      setContent(value);
      if (contentError) setContentError(null);
    },
    contentError,
    recordedOn,
    setRecordedOn: (value) => {
      setRecordedOn(value);
      if (dateError) setDateError(null);
    },
    dateError,
    formError,
    saving,
    deleting,
    submit,
    remove,
  };
}

export { HEALTH_RECORD_CONTENT_MAX_LENGTH, HEALTH_RECORD_TITLE_MAX_LENGTH };
