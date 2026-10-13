import { useEffect, useMemo, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteFamilyMemberRepository } from '@/db/repositories/family-member-repository';
import { SqliteFamilyRequestRepository } from '@/db/repositories/family-request-repository';
import { SqliteGroceryRepository } from '@/db/repositories/grocery-repository';
import { SqliteNoteRepository } from '@/db/repositories/note-repository';
import { SqliteTaskRepository } from '@/db/repositories/task-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { createFamilyRequestService } from '@/services/family-request-service';
import { createGroceryService } from '@/services/grocery-service';
import { createNoteService } from '@/services/note-service';
import { createTaskService } from '@/services/task-service';

export type SavedResultKind = 'task' | 'note' | 'request' | 'grocery';

export interface SavedSearchResult {
  kind: SavedResultKind;
  id: string;
  title: string;
  /** ISO-8601 UTC timestamp of the last change. */
  updatedAt: string;
}

export interface UseSavedSearchResult {
  /** Matches for a non-empty query, most relevant first. */
  saved: SavedSearchResult[];
  /** Recently touched items, shown while the query is empty. */
  recent: SavedSearchResult[];
}

const PER_SOURCE_LIMIT = 5;
const RECENT_LIMIT = 6;

/**
 * Saved items (tasks, notes, family requests, grocery lists) matching the
 * query, plus recent activity for an empty query. Everything is local
 * SQLite, so results arrive in milliseconds with no debounce.
 */
export function useSavedSearch(query: string): UseSavedSearchResult {
  const db = useSQLiteContext();
  const taskService = useMemo(
    () => createTaskService(new SqliteTaskRepository(toSqlDatabase(db))),
    [db],
  );
  const noteService = useMemo(
    () => createNoteService(new SqliteNoteRepository(toSqlDatabase(db))),
    [db],
  );
  const requestService = useMemo(() => {
    const sql = toSqlDatabase(db);
    return createFamilyRequestService(new SqliteFamilyRequestRepository(sql), {
      members: new SqliteFamilyMemberRepository(sql),
      tasks: taskService,
    });
  }, [db, taskService]);
  const groceryService = useMemo(
    () => createGroceryService(new SqliteGroceryRepository(toSqlDatabase(db))),
    [db],
  );

  const [saved, setSaved] = useState<SavedSearchResult[]>([]);
  const [recent, setRecent] = useState<SavedSearchResult[]>([]);
  /** Guards against out-of-order responses on rapid typing. */
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const trimmed = query.trim();
    if (trimmed === '') {
      void (async () => {
        try {
          const [tasks, notes] = await Promise.all([
            taskService.list({ limit: 15 }),
            noteService.list({ limit: 15 }),
          ]);
          if (requestIdRef.current !== requestId) {
            return;
          }
          const merged: SavedSearchResult[] = [
            ...tasks.map((task) => ({
              kind: 'task' as const,
              id: task.id,
              title: task.title,
              updatedAt: task.updatedAt,
            })),
            ...notes.map((note) => ({
              kind: 'note' as const,
              id: note.id,
              title: note.title,
              updatedAt: note.updatedAt,
            })),
          ];
          merged.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
          setRecent(merged.slice(0, RECENT_LIMIT));
          setSaved([]);
        } catch {
          if (requestIdRef.current === requestId) {
            setRecent([]);
          }
        }
      })();
      return;
    }
    void (async () => {
      try {
        const [tasks, notes, requests, lists] = await Promise.all([
          taskService.list({ search: trimmed, limit: PER_SOURCE_LIMIT }),
          noteService.list({ search: trimmed, limit: PER_SOURCE_LIMIT }),
          requestService.list({ search: trimmed, limit: PER_SOURCE_LIMIT }),
          groceryService.listSummaries({ search: trimmed, limit: PER_SOURCE_LIMIT }),
        ]);
        if (requestIdRef.current !== requestId) {
          return;
        }
        setSaved([
          ...tasks.map((task) => ({
            kind: 'task' as const,
            id: task.id,
            title: task.title,
            updatedAt: task.updatedAt,
          })),
          ...notes.map((note) => ({
            kind: 'note' as const,
            id: note.id,
            title: note.title,
            updatedAt: note.updatedAt,
          })),
          ...requests.map((request) => ({
            kind: 'request' as const,
            id: request.id,
            title: request.title,
            updatedAt: request.updatedAt,
          })),
          ...lists.map((list) => ({
            kind: 'grocery' as const,
            id: list.id,
            title: list.name,
            updatedAt: list.updatedAt,
          })),
        ]);
        setRecent([]);
      } catch {
        if (requestIdRef.current === requestId) {
          setSaved([]);
        }
      }
    })();
  }, [query, taskService, noteService, requestService, groceryService]);

  return { saved, recent };
}
