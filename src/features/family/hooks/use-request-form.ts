import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteFamilyMemberRepository } from '@/db/repositories/family-member-repository';
import { SqliteFamilyRequestRepository } from '@/db/repositories/family-request-repository';
import { SqliteTaskRepository } from '@/db/repositories/task-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createFamilyMemberService } from '@/services/family-member-service';
import { createFamilyRequestService } from '@/services/family-request-service';
import { createTaskService } from '@/services/task-service';
import type {
  FamilyMember,
  FamilyRequestCategory,
  FamilyRequestStatus,
} from '@/types/family';
import { parseAmountToMinor } from '@/utils/money';

export interface UseRequestFormResult {
  mode: 'new' | 'edit';
  loading: boolean;
  loadError: string | null;
  title: string;
  setTitle: (value: string) => void;
  details: string;
  setDetails: (value: string) => void;
  memberId: string | null;
  setMemberId: (id: string | null) => void;
  category: FamilyRequestCategory;
  setCategory: (category: FamilyRequestCategory) => void;
  priority: 'low' | 'medium' | 'high';
  setPriority: (priority: 'low' | 'medium' | 'high') => void;
  deadline: string | null;
  setDeadline: (deadline: string | null) => void;
  costText: string;
  setCostText: (value: string) => void;
  members: FamilyMember[];
  taskId: string | null;
  /** Edit mode only; changed via `changeStatus` (persisted immediately). */
  status: FamilyRequestStatus;
  changeStatus: (status: FamilyRequestStatus) => Promise<void>;
  saving: boolean;
  notice: string | null;
  clearNotice: () => void;
  createdAt: string | null;
  updatedAt: string | null;
  /** Resolves true when the request was stored and the screen may go back. */
  save: () => Promise<boolean>;
  /** Resolves true when the request was deleted and the screen may go back. */
  remove: () => Promise<boolean>;
  /** Resolves true when a task was generated from this request. */
  generateTask: () => Promise<boolean>;
}

/** Create/edit state for one family request, including task generation. */
export function useRequestForm(requestId: string | null): UseRequestFormResult {
  const db = useSQLiteContext();
  const { requestService, memberService } = useMemo(() => {
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

  const [loading, setLoading] = useState(requestId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [category, setCategory] = useState<FamilyRequestCategory>('other');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [deadline, setDeadline] = useState<string | null>(null);
  const [costText, setCostText] = useState('');
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatusState] = useState<FamilyRequestStatus>('open');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const memberList = await memberService.list({});
        if (cancelled) return;
        setMembers(memberList);

        if (requestId) {
          const request = await requestService.getById(requestId);
          if (cancelled) return;
          setTitle(request.title);
          setDetails(request.details ?? '');
          setMemberId(request.memberId);
          setCategory(request.category);
          setPriority(request.priority);
          setDeadline(request.deadline);
          setCostText(
            request.estimatedCostMinor === null ? '' : String(request.estimatedCostMinor / 100),
          );
          setTaskId(await requestService.getTaskLink(requestId));
          setStatusState(request.status);
          setCreatedAt(request.createdAt);
          setUpdatedAt(request.updatedAt);
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
  }, [requestService, memberService, requestId, t]);

  const editTitle = useCallback((value: string) => {
    setTitle(value);
    setNotice(null);
  }, []);

  const editDetails = useCallback((value: string) => {
    setDetails(value);
    setNotice(null);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const trimmedCost = costText.trim();
    const estimatedCostMinor = trimmedCost.length > 0 ? parseAmountToMinor(trimmedCost) : null;
    if (trimmedCost.length > 0 && estimatedCostMinor === null) {
      setNotice(t('validation.family_request_cost_invalid'));
      return false;
    }

    const payload = {
      title,
      details: details.trim().length > 0 ? details.trim() : null,
      memberId,
      category,
      priority,
      deadline,
      estimatedCostMinor,
    };
    setSaving(true);
    try {
      if (requestId) {
        const updated = await requestService.update(requestId, payload);
        setUpdatedAt(updated.updatedAt);
      } else {
        await requestService.create(payload);
      }
      return true;
    } catch (error) {
      setNotice(translateError(error, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [requestService, requestId, title, details, memberId, category, priority, deadline, costText, t]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!requestId) {
      return false;
    }
    setSaving(true);
    try {
      await requestService.remove(requestId);
      return true;
    } catch (error) {
      setNotice(translateError(error, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [requestService, requestId, t]);

  const generateTask = useCallback(async (): Promise<boolean> => {
    if (!requestId) {
      return false;
    }
    try {
      const task = await requestService.generateTask(requestId);
      setTaskId(task.id);
      return true;
    } catch (error) {
      setNotice(translateError(error, t));
      return false;
    }
  }, [requestService, requestId, t]);

  const changeStatus = useCallback(
    async (next: FamilyRequestStatus) => {
      if (!requestId) {
        return;
      }
      try {
        await requestService.setStatus(requestId, next);
        setStatusState(next);
      } catch (error) {
        setNotice(translateError(error, t));
      }
    },
    [requestService, requestId, t],
  );

  return {
    mode: requestId ? 'edit' : 'new',
    loading,
    loadError,
    title,
    setTitle: editTitle,
    details,
    setDetails: editDetails,
    memberId,
    setMemberId,
    category,
    setCategory,
    priority,
    setPriority,
    deadline,
    setDeadline,
    costText,
    setCostText,
    members,
    taskId,
    status,
    changeStatus,
    saving,
    notice,
    clearNotice: () => setNotice(null),
    createdAt,
    updatedAt,
    save,
    remove,
    generateTask,
  };
}
