import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteNoteRepository } from '@/db/repositories/note-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError, translateValidationCode } from '@/i18n/errors';
import { createNoteService } from '@/services/note-service';
import { validateTagName } from '@/services/note-validation';
import type { NoteCategoryWithUsage, NoteTag } from '@/types/note';

export interface UseNoteFormResult {
  mode: 'new' | 'edit';
  loading: boolean;
  loadError: string | null;
  title: string;
  setTitle: (value: string) => void;
  content: string;
  setContent: (value: string) => void;
  categoryId: string | null;
  setCategoryId: (id: string | null) => void;
  categories: NoteCategoryWithUsage[];
  newCategoryName: string;
  setNewCategoryName: (value: string) => void;
  addCategory: () => Promise<void>;
  existingTags: NoteTag[];
  selectedTagNames: string[];
  toggleTagName: (name: string) => void;
  newTagName: string;
  setNewTagName: (value: string) => void;
  addNewTag: () => void;
  pinned: boolean;
  setPinned: (value: boolean) => void;
  saving: boolean;
  notice: string | null;
  clearNotice: () => void;
  createdAt: string | null;
  updatedAt: string | null;
  /** Resolves true when the note was stored and the screen may go back. */
  save: () => Promise<boolean>;
  /** Resolves true when the note was deleted and the screen may go back. */
  remove: () => Promise<boolean>;
}

/** Create/edit state for one note, including categories, tags, and pinning. */
export function useNoteForm(noteId: string | null): UseNoteFormResult {
  const db = useSQLiteContext();
  const service = useMemo(() => createNoteService(new SqliteNoteRepository(toSqlDatabase(db))), [db]);
  const { t } = useTranslation();

  const [loading, setLoading] = useState(noteId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<NoteCategoryWithUsage[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [existingTags, setExistingTags] = useState<NoteTag[]>([]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [categoryList, tagList] = await Promise.all([
          service.listCategories(),
          service.listTags(),
        ]);
        if (cancelled) return;
        setCategories(categoryList);
        setExistingTags(tagList);

        if (noteId) {
          const note = await service.getById(noteId);
          if (cancelled) return;
          setTitle(note.title);
          setContent(note.content);
          setCategoryId(note.categoryId);
          setSelectedTagNames(note.tags.map((tag) => tag.name));
          setPinned(note.isPinned);
          setCreatedAt(note.createdAt);
          setUpdatedAt(note.updatedAt);
        }
        setLoadError(null);
      } catch (error) {
        if (!cancelled) {
          setLoadError(translateError(error, t));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [service, noteId, t]);

  const editTitle = useCallback((value: string) => {
    setTitle(value);
    setNotice(null);
  }, []);

  const editContent = useCallback((value: string) => {
    setContent(value);
    setNotice(null);
  }, []);

  const addCategory = useCallback(async () => {
    try {
      const category = await service.createCategory(newCategoryName);
      setCategories((current) =>
        [...current, { ...category, noteCount: 0 }].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        ),
      );
      setCategoryId(category.id);
      setNewCategoryName('');
    } catch (error) {
      setNotice(translateError(error, t));
    }
  }, [service, newCategoryName, t]);

  const toggleTagName = useCallback((name: string) => {
    setSelectedTagNames((current) => {
      const key = name.toLowerCase();
      const existing = current.find((value) => value.toLowerCase() === key);
      if (existing) {
        return current.filter((value) => value !== existing);
      }
      return [...current, name];
    });
  }, []);

  const addNewTag = useCallback(() => {
    const name = newTagName.trim();
    if (name.length === 0) {
      return;
    }
    const error = validateTagName(name);
    if (error) {
      setNotice(translateValidationCode(error, t));
      return;
    }
    const key = name.toLowerCase();
    setSelectedTagNames((current) =>
      current.some((value) => value.toLowerCase() === key) ? current : [...current, name],
    );
    setNewTagName('');
  }, [newTagName, t]);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const payload = {
        title,
        content,
        categoryId,
        tagNames: selectedTagNames,
        isPinned: pinned,
      };
      if (noteId) {
        await service.update(noteId, payload);
      } else {
        await service.create(payload);
      }
      return true;
    } catch (error) {
      setNotice(translateError(error, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [service, noteId, title, content, categoryId, selectedTagNames, pinned, t]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!noteId) {
      return false;
    }
    setSaving(true);
    try {
      await service.remove(noteId);
      return true;
    } catch (error) {
      setNotice(translateError(error, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [service, noteId, t]);

  return {
    mode: noteId ? 'edit' : 'new',
    loading,
    loadError,
    title,
    setTitle: editTitle,
    content,
    setContent: editContent,
    categoryId,
    setCategoryId,
    categories,
    newCategoryName,
    setNewCategoryName,
    addCategory,
    existingTags,
    selectedTagNames,
    toggleTagName,
    newTagName,
    setNewTagName,
    addNewTag,
    pinned,
    setPinned,
    saving,
    notice,
    clearNotice: () => setNotice(null),
    createdAt,
    updatedAt,
    save,
    remove,
  };
}
