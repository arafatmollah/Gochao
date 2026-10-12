import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteNoteRepository } from '@/db/repositories/note-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createNoteService } from '@/services/note-service';
import type { NoteCategoryWithUsage, NoteListItem } from '@/types/note';

export interface UseNotesResult {
  notes: NoteListItem[];
  categories: NoteCategoryWithUsage[];
  search: string;
  setSearch: (value: string) => void;
  categoryId: string | null;
  setCategoryId: (id: string | null) => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  notice: string | null;
  clearNotice: () => void;
  refresh: () => void;
  togglePin: (note: NoteListItem) => Promise<void>;
}

/** Notes list state: debounced offline search, category filter, pin toggling. */
export function useNotes(): UseNotesResult {
  const db = useSQLiteContext();
  const service = useMemo(() => createNoteService(new SqliteNoteRepository(toSqlDatabase(db))), [db]);
  const { t } = useTranslation();

  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [categories, setCategories] = useState<NoteCategoryWithUsage[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const debouncedSearch = useDebouncedValue(search, 250);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const [list, categoryList] = await Promise.all([
        service.list({
          search: debouncedSearch.trim().length > 0 ? debouncedSearch : undefined,
          categoryId: categoryId ?? undefined,
        }),
        service.listCategories(),
      ]);
      if (requestIdRef.current !== requestId) return;
      setNotes(list);
      setCategories(categoryList);
      setError(null);
    } catch (loadError) {
      if (requestIdRef.current !== requestId) return;
      setError(translateError(loadError, t));
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [service, debouncedSearch, categoryId, t]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await load();
      })();
    }, [load]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const togglePin = useCallback(
    async (note: NoteListItem) => {
      try {
        await service.setPinned(note.id, !note.isPinned);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  return {
    notes,
    categories,
    search,
    setSearch,
    categoryId,
    setCategoryId,
    loading,
    refreshing,
    error,
    notice,
    clearNotice: () => setNotice(null),
    refresh,
    togglePin,
  };
}
