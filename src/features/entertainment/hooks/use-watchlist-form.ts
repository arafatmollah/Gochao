import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteWatchlistRepository } from '@/db/repositories/entertainment-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createEntertainmentService } from '@/services/entertainment-service';
import { validateWatchNotes, validateWatchTitle, validateWatchUrl } from '@/services/entertainment-validation';
import {
  WATCH_KINDS,
  WATCH_NOTES_MAX_LENGTH,
  WATCH_STATUSES,
  WATCH_TITLE_MAX_LENGTH,
  WATCH_URL_MAX_LENGTH,
  type WatchKind,
  type WatchStatus,
} from '@/types/entertainment';

export interface UseWatchlistFormResult {
  isEdit: boolean;
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;

  title: string;
  setTitle: (value: string) => void;
  /** Validation code (see `entertainment-validation`); translate before rendering. */
  titleError: string | null;
  kind: WatchKind;
  setKind: (kind: WatchKind) => void;
  status: WatchStatus;
  setStatus: (status: WatchStatus) => void;
  url: string;
  setUrl: (value: string) => void;
  urlError: string | null;
  /** 1–5, or null when unrated. */
  rating: number | null;
  setRating: (rating: number | null) => void;
  notes: string;
  setNotes: (value: string) => void;
  notesError: string | null;

  formError: string | null;
  saving: boolean;
  deleting: boolean;
  submit: () => Promise<boolean>;
  remove: () => Promise<boolean>;
}

export function useWatchlistForm(itemId?: string): UseWatchlistFormResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createEntertainmentService(new SqliteWatchlistRepository(toSqlDatabase(db))),
    [db],
  );
  const { t } = useTranslation();
  const isEdit = itemId !== undefined;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<WatchKind>('movie');
  const [status, setStatus] = useState<WatchStatus>('want_to_watch');
  const [url, setUrl] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const [titleError, setTitleError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEdit || !itemId) {
      return;
    }
    let active = true;
    service
      .getById(itemId)
      .then((item) => {
        if (!active) return;
        setTitle(item.title);
        if ((WATCH_KINDS as readonly string[]).includes(item.kind)) {
          setKind(item.kind);
        }
        if ((WATCH_STATUSES as readonly string[]).includes(item.status)) {
          setStatus(item.status);
        }
        setUrl(item.url ?? '');
        setRating(item.rating);
        setNotes(item.notes ?? '');
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
  }, [isEdit, itemId, service, reloadKey, t]);

  const validate = useCallback((): boolean => {
    const titleValidation = validateWatchTitle(title);
    const urlValidation = validateWatchUrl(url);
    const notesValidation = validateWatchNotes(notes);
    setTitleError(titleValidation);
    setUrlError(urlValidation);
    setNotesError(notesValidation);
    return (
      titleValidation === null && urlValidation === null && notesValidation === null
    );
  }, [title, url, notes]);

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
        kind,
        status,
        url: url.trim() === '' ? null : url,
        rating,
        notes,
      };
      if (isEdit && itemId) {
        await service.update(itemId, payload);
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
  }, [saving, deleting, validate, isEdit, itemId, service, title, kind, status, url, rating, notes, t]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isEdit || !itemId || saving || deleting) {
      return false;
    }
    setFormError(null);
    setDeleting(true);
    try {
      await service.remove(itemId);
      return true;
    } catch (removeError) {
      setFormError(translateError(removeError, t));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [isEdit, itemId, saving, deleting, service, t]);

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
    kind,
    setKind,
    status,
    setStatus,
    url,
    setUrl: (value) => {
      setUrl(value);
      if (urlError) setUrlError(null);
    },
    urlError,
    rating,
    setRating,
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

export { WATCH_NOTES_MAX_LENGTH, WATCH_TITLE_MAX_LENGTH, WATCH_URL_MAX_LENGTH };
