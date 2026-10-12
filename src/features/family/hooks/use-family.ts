import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteFamilyMemberRepository } from '@/db/repositories/family-member-repository';
import { SqliteFamilyRequestRepository } from '@/db/repositories/family-request-repository';
import { SqliteTaskRepository } from '@/db/repositories/task-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createFamilyMemberService } from '@/services/family-member-service';
import { createFamilyRequestService } from '@/services/family-request-service';
import { createTaskService } from '@/services/task-service';
import type { FamilyMember, FamilyRequestListItem, FamilyRequestStatus } from '@/types/family';

export type FamilySegment = 'requests' | 'members';
export type RequestStatusFilter = 'all' | FamilyRequestStatus;

export const REQUEST_STATUS_FILTERS: RequestStatusFilter[] = [
  'all',
  'open',
  'in_progress',
  'done',
  'cancelled',
];

export interface UseFamilyResult {
  segment: FamilySegment;
  setSegment: (segment: FamilySegment) => void;
  statusFilter: RequestStatusFilter;
  setStatusFilter: (status: RequestStatusFilter) => void;
  memberFilterId: string | null;
  setMemberFilterId: (id: string | null) => void;
  search: string;
  setSearch: (value: string) => void;
  requests: FamilyRequestListItem[];
  members: FamilyMember[];
  /** Active members for the member-filter chips. */
  filterMembers: FamilyMember[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  notice: string | null;
  clearNotice: () => void;
  refresh: () => void;
  setRequestStatus: (request: FamilyRequestListItem, status: FamilyRequestStatus) => Promise<void>;
  generateTask: (request: FamilyRequestListItem) => Promise<boolean>;
  removeRequest: (id: string) => Promise<boolean>;
  toggleMemberArchive: (member: FamilyMember) => Promise<void>;
  removeMember: (id: string) => Promise<boolean>;
}

/** Family screen state: request/member segments, status+member filters, actions. */
export function useFamily(): UseFamilyResult {
  const db = useSQLiteContext();
  const { memberService, requestService } = useMemo(() => {
    const sql = toSqlDatabase(db);
    const memberRepo = new SqliteFamilyMemberRepository(sql);
    const requestRepo = new SqliteFamilyRequestRepository(sql);
    const taskService = createTaskService(new SqliteTaskRepository(sql));
    return {
      memberService: createFamilyMemberService(memberRepo),
      requestService: createFamilyRequestService(requestRepo, {
        members: memberRepo,
        tasks: taskService,
      }),
    };
  }, [db]);
  const { t } = useTranslation();

  const [segment, setSegment] = useState<FamilySegment>('requests');
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>('all');
  const [memberFilterId, setMemberFilterId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [requests, setRequests] = useState<FamilyRequestListItem[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const debouncedSearch = useDebouncedValue(search, 250);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const [requestList, memberList] = await Promise.all([
        requestService.list({
          status: statusFilter === 'all' ? undefined : statusFilter,
          memberId: memberFilterId ?? undefined,
          search: debouncedSearch.trim().length > 0 ? debouncedSearch : undefined,
        }),
        memberService.list({}),
      ]);
      if (requestIdRef.current !== requestId) return;
      setRequests(requestList);
      setMembers(memberList);
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
  }, [requestService, memberService, statusFilter, memberFilterId, debouncedSearch, t]);

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

  const setRequestStatus = useCallback(
    async (request: FamilyRequestListItem, status: FamilyRequestStatus) => {
      try {
        await requestService.setStatus(request.id, status);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [requestService, load, t],
  );

  const generateTask = useCallback(
    async (request: FamilyRequestListItem): Promise<boolean> => {
      try {
        await requestService.generateTask(request.id);
        await load();
        return true;
      } catch (actionError) {
        setNotice(translateError(actionError, t));
        return false;
      }
    },
    [requestService, load, t],
  );

  const removeRequest = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await requestService.remove(id);
        await load();
        return true;
      } catch (actionError) {
        setNotice(translateError(actionError, t));
        return false;
      }
    },
    [requestService, load, t],
  );

  const toggleMemberArchive = useCallback(
    async (member: FamilyMember) => {
      try {
        await memberService.setArchived(member.id, !member.isArchived);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [memberService, load, t],
  );

  const removeMember = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await memberService.remove(id);
        await load();
        return true;
      } catch (actionError) {
        setNotice(translateError(actionError, t));
        return false;
      }
    },
    [memberService, load, t],
  );

  return {
    segment,
    setSegment,
    statusFilter,
    setStatusFilter,
    memberFilterId,
    setMemberFilterId,
    search,
    setSearch,
    requests,
    members,
    filterMembers: members.filter((member) => !member.isArchived),
    loading,
    refreshing,
    error,
    notice,
    clearNotice: () => setNotice(null),
    refresh,
    setRequestStatus,
    generateTask,
    removeRequest,
    toggleMemberArchive,
    removeMember,
  };
}
