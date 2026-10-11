import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteCategoryRepository } from '@/db/repositories/category-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createCategoryService } from '@/services/category-service';
import { validateCategoryName } from '@/services/finance-validation';
import type { CategoryKind } from '@/types/finance';

export interface UseCategoryFormResult {
  isEdit: boolean;
  /** Built-in categories cannot be renamed or deleted, only archived. */
  isBuiltin: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;

  name: string;
  setName: (value: string) => void;
  /** Validation code (`category_name_*`); translate before rendering. */
  nameError: string | null;
  kind: CategoryKind;
  setKind: (value: CategoryKind) => void;

  isArchived: boolean;
  formError: string | null;
  saving: boolean;
  archiving: boolean;
  deleting: boolean;
  submit: () => Promise<boolean>;
  toggleArchive: () => Promise<boolean>;
  remove: () => Promise<boolean>;
}

export function useCategoryForm(categoryId?: string): UseCategoryFormResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createCategoryService(new SqliteCategoryRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();
  const isEdit = categoryId !== undefined;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [isBuiltin, setIsBuiltin] = useState(false);
  const [isArchived, setIsArchived] = useState(false);

  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEdit || !categoryId) {
      return;
    }
    let active = true;
    service
      .getById(categoryId)
      .then((category) => {
        if (!active) return;
        setName(category.name);
        setKind(category.kind);
        setIsBuiltin(category.isBuiltin);
        setIsArchived(category.isArchived);
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
  }, [isEdit, categoryId, service, reloadKey, t]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (saving || archiving || deleting) {
      return false;
    }
    setFormError(null);

    const trimmedName = name.trim();
    const nameValidation = validateCategoryName(trimmedName);
    // Built-in names are translated by id, so only custom names are validated as edits.
    const nameToSave = isBuiltin ? null : trimmedName;
    setNameError(isBuiltin ? null : nameValidation);
    if (!isBuiltin && nameValidation !== null) {
      return false;
    }

    setSaving(true);
    try {
      if (isEdit && categoryId) {
        await service.update(categoryId, nameToSave === null ? {} : { name: nameToSave });
      } else {
        await service.create({ kind, name: trimmedName });
      }
      return true;
    } catch (submitError) {
      setFormError(translateError(submitError, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, archiving, deleting, name, isBuiltin, isEdit, categoryId, kind, service, t]);

  const toggleArchive = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !categoryId || saving || archiving || deleting) {
      return false;
    }
    setFormError(null);
    setArchiving(true);
    try {
      await service.update(categoryId, { isArchived: !isArchived });
      return true;
    } catch (archiveError) {
      setFormError(translateError(archiveError, t));
      return false;
    } finally {
      setArchiving(false);
    }
  }, [isEdit, categoryId, saving, archiving, deleting, isArchived, service, t]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !categoryId || saving || archiving || deleting) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await service.remove(categoryId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, categoryId, saving, archiving, deleting, service, t]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoadState('loading');
    setReloadKey((key) => key + 1);
  }, []);

  return {
    isEdit,
    isBuiltin,
    loadState,
    loadError,
    retryLoad,
    name,
    setName: (value) => {
      setName(value);
      if (nameError) setNameError(null);
    },
    nameError,
    kind,
    setKind,
    isArchived,
    formError,
    saving,
    archiving,
    deleting,
    submit,
    toggleArchive,
    remove,
  };
}
