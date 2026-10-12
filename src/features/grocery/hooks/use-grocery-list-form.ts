import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteGroceryRepository } from '@/db/repositories/grocery-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createGroceryService } from '@/services/grocery-service';
import { validateGroceryListName, validateGroceryNotes } from '@/services/grocery-validation';
import { GROCERY_LIST_NAME_MAX_LENGTH, GROCERY_NOTES_MAX_LENGTH } from '@/types/grocery';

export interface UseGroceryListFormResult {
  isEdit: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;

  name: string;
  setName: (value: string) => void;
  /** Validation code (see `grocery-validation`); translate before rendering. */
  nameError: string | null;
  notes: string;
  setNotes: (value: string) => void;
  /** Validation code (see `grocery-validation`); translate before rendering. */
  notesError: string | null;

  formError: string | null;
  saving: boolean;
  deleting: boolean;
  submit: () => Promise<boolean>;
  remove: () => Promise<boolean>;
}

export function useGroceryListForm(listId?: string): UseGroceryListFormResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createGroceryService(new SqliteGroceryRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();
  const isEdit = listId !== undefined;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  const [nameError, setNameError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEdit || !listId) {
      return;
    }
    let active = true;
    service
      .getListById(listId)
      .then((list) => {
        if (!active) return;
        setName(list.name);
        setNotes(list.notes ?? '');
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
  }, [isEdit, listId, service, reloadKey, t]);

  const validate = useCallback((): boolean => {
    const nameValidation = validateGroceryListName(name);
    const notesValidation = validateGroceryNotes(notes);
    setNameError(nameValidation);
    setNotesError(notesValidation);
    return nameValidation === null && notesValidation === null;
  }, [name, notes]);

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
      if (isEdit && listId) {
        await service.updateList(listId, { name, notes });
      } else {
        await service.createList({ name, notes });
      }
      return true;
    } catch (submitError) {
      setFormError(translateError(submitError, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, deleting, validate, isEdit, listId, service, name, notes, t]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !listId || saving || deleting) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await service.removeList(listId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, listId, saving, deleting, service, t]);

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
    name,
    setName: (value) => {
      setName(value);
      if (nameError) setNameError(null);
    },
    nameError,
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

export { GROCERY_LIST_NAME_MAX_LENGTH, GROCERY_NOTES_MAX_LENGTH };
