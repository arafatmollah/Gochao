import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteTaskRepository } from '@/db/repositories/task-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createTaskService } from '@/services/task-service';
import { validateTaskDescription, validateTaskTitle } from '@/services/task-validation';
import type { TaskPriority } from '@/types/task';

export interface UseTaskFormResult {
  isEdit: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;

  title: string;
  setTitle: (value: string) => void;
  /** Validation code (see `task-validation`); translate before rendering. */
  titleError: string | null;
  description: string;
  setDescription: (value: string) => void;
  /** Validation code (see `task-validation`); translate before rendering. */
  descriptionError: string | null;
  priority: TaskPriority;
  setPriority: (value: TaskPriority) => void;
  dueAt: string | null;
  setDueAt: (value: string | null) => void;

  formError: string | null;
  saving: boolean;
  deleting: boolean;
  submit: () => Promise<boolean>;
  remove: () => Promise<boolean>;
}

export function useTaskForm(taskId?: string): UseTaskFormResult {
  const db = useSQLiteContext();
  const service = useMemo(() => createTaskService(new SqliteTaskRepository(toSqlDatabase(db))), [db]);
  const { t } = useTranslation();
  const isEdit = taskId !== undefined;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(isEdit ? 'loading' : 'ready');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueAt, setDueAt] = useState<string | null>(null);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEdit || !taskId) {
      return;
    }
    let active = true;
    service
      .getById(taskId)
      .then((task) => {
        if (!active) return;
        setTitle(task.title);
        setDescription(task.description ?? '');
        setPriority(task.priority);
        setDueAt(task.dueAt);
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
  }, [isEdit, taskId, service, reloadKey, t]);

  const validate = useCallback((): boolean => {
    const titleValidation = validateTaskTitle(title);
    const descriptionValidation = validateTaskDescription(description);
    setTitleError(titleValidation);
    setDescriptionError(descriptionValidation);
    return titleValidation === null && descriptionValidation === null;
  }, [title, description]);

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
      if (isEdit && taskId) {
        await service.update(taskId, { title, description, priority, dueAt });
      } else {
        await service.create({ title, description, priority, dueAt });
      }
      return true;
    } catch (submitError) {
      setFormError(translateError(submitError, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, deleting, validate, isEdit, taskId, service, title, description, priority, dueAt, t]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !taskId || saving || deleting) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await service.remove(taskId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, taskId, saving, deleting, service, t]);

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
    description,
    setDescription: (value) => {
      setDescription(value);
      if (descriptionError) setDescriptionError(null);
    },
    descriptionError,
    priority,
    setPriority,
    dueAt,
    setDueAt,
    formError,
    saving,
    deleting,
    submit,
    remove,
  };
}
