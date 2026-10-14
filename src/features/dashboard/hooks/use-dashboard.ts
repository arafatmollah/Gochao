import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteAccountRepository } from '@/db/repositories/account-repository';
import { SqliteBillRepository } from '@/db/repositories/bill-repository';
import { SqliteCategoryRepository } from '@/db/repositories/category-repository';
import { SqliteFamilyMemberRepository } from '@/db/repositories/family-member-repository';
import { SqliteFamilyRequestRepository } from '@/db/repositories/family-request-repository';
import { SqliteMedicineRepository } from '@/db/repositories/health-repository';
import { SqliteNoteRepository } from '@/db/repositories/note-repository';
import { SqlitePrayerRepository } from '@/db/repositories/prayer-repository';
import { SqliteTaskRepository } from '@/db/repositories/task-repository';
import { SqliteTransactionRepository } from '@/db/repositories/transaction-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createAccountService } from '@/services/account-service';
import { createBillService } from '@/services/bill-service';
import { createFamilyRequestService } from '@/services/family-request-service';
import { createMedicineService } from '@/services/medicine-service';
import { createNoteService } from '@/services/note-service';
import { createPrayerService } from '@/services/prayer-service';
import { calculateRestrictedWindows, calculateSunrise } from '@/services/prayer-calculation';
import type { RestrictedWindow } from '@/services/prayer-calculation';
import { createTaskService } from '@/services/task-service';
import { createTransactionService } from '@/services/transaction-service';
import type { BillDueItem } from '@/types/bill';
import type { FamilyRequestListItem } from '@/types/family';
import type { DoseStatus, DueDose } from '@/types/health';
import type { NoteListItem } from '@/types/note';
import type { PrayerDay } from '@/types/prayer';
import type { Task } from '@/types/task';
import {
  localDayBoundsIso,
  monthBoundsForKey,
  monthKeyOf,
  todayIsoDate,
} from '@/utils/dates';

import {
  buildDashboardFinance,
  EMPTY_DASHBOARD_FINANCE,
  type DashboardFinance,
} from '../finance-summary';
import { buildDashboardSummary, type DashboardSummary } from '../summary';

/** Upper bound for the rows rendered on the dashboard. */
const DASHBOARD_TASK_LIMIT = 50;
/** The dashboard previews only the nearest few upcoming bills. */
const DASHBOARD_BILL_LIMIT = 5;
/** The dashboard previews the first few of today's due doses. */
const DASHBOARD_DOSE_LIMIT = 3;
/** The dashboard previews the few most recent (pinned-first) notes. */
const DASHBOARD_NOTE_LIMIT = 3;
/** The dashboard previews the nearest few outstanding family requests. */
const DASHBOARD_FAMILY_REQUEST_LIMIT = 3;

export interface UseDashboardResult {
  summary: DashboardSummary;
  /** Money figures for the finance card, all derived from stored records. */
  finance: DashboardFinance;
  /** Pending tasks due today or overdue, ordered by the repository. */
  tasks: Task[];
  /** Nearest pending bill occurrences; the full list lives on the Bills tab. */
  upcomingBills: BillDueItem[];
  /** Pinned-first recent notes preview; the full list lives on /notes. */
  recentNotes: NoteListItem[];
  /** Outstanding (open/in-progress) family requests, nearest deadline first. */
  openFamilyRequests: FamilyRequestListItem[];
  openRequestCount: number;
  /** Today's prayer schedule with statuses; null when unavailable (widget hides). */
  prayerDay: PrayerDay | null;
  /** Voluntary-prayer pause windows for today; the widget honors them. */
  prayerRestricted: RestrictedWindow[];
  /** Today's due doses (first few); the full checklist lives on /health. */
  dueDoses: DueDose[];
  today: string;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  notice: string | null;
  clearNotice: () => void;
  refresh: () => void;
  toggleComplete: (task: Task) => Promise<void>;
  toggleNotePin: (note: NoteListItem) => Promise<void>;
  logDose: (dose: DueDose, status: DoseStatus) => Promise<void>;
  clearDose: (dose: DueDose) => Promise<void>;
}

const EMPTY_SUMMARY = buildDashboardSummary({
  pendingDueCount: 0,
  overdueCount: 0,
  dueTodayCount: 0,
  completedTodayCount: 0,
});

export function useDashboard(): UseDashboardResult {
  const db = useSQLiteContext();
  const service = useMemo(() => createTaskService(new SqliteTaskRepository(toSqlDatabase(db))), [db]);
  const billService = useMemo(
    () => createBillService(new SqliteBillRepository(toSqlDatabase(db))),
    [db],
  );
  const transactionService = useMemo(
    () =>
      createTransactionService(new SqliteTransactionRepository(toSqlDatabase(db)), {
        accounts: new SqliteAccountRepository(toSqlDatabase(db)),
        categories: new SqliteCategoryRepository(toSqlDatabase(db)),
      }),
    [db],
  );
  const accountService = useMemo(
    () => createAccountService(new SqliteAccountRepository(toSqlDatabase(db))),
    [db],
  );
  const noteService = useMemo(
    () => createNoteService(new SqliteNoteRepository(toSqlDatabase(db))),
    [db],
  );
  const prayerService = useMemo(
    () => createPrayerService(new SqlitePrayerRepository(toSqlDatabase(db))),
    [db],
  );
  const medicineService = useMemo(
    () => createMedicineService(new SqliteMedicineRepository(toSqlDatabase(db))),
    [db],
  );
  const familyRequestService = useMemo(() => {
    const sql = toSqlDatabase(db);
    const memberRepo = new SqliteFamilyMemberRepository(sql);
    const requestRepo = new SqliteFamilyRequestRepository(sql);
    return createFamilyRequestService(requestRepo, {
      members: memberRepo,
      tasks: createTaskService(new SqliteTaskRepository(sql)),
    });
  }, [db]);
  const { t } = useTranslation();

  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [finance, setFinance] = useState<DashboardFinance>(EMPTY_DASHBOARD_FINANCE);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<BillDueItem[]>([]);
  const [recentNotes, setRecentNotes] = useState<NoteListItem[]>([]);
  const [openFamilyRequests, setOpenFamilyRequests] = useState<FamilyRequestListItem[]>([]);
  const [openRequestCount, setOpenRequestCount] = useState(0);
  const [prayerDay, setPrayerDay] = useState<PrayerDay | null>(null);
  const [prayerRestricted, setPrayerRestricted] = useState<RestrictedWindow[]>([]);
  const [dueDoses, setDueDoses] = useState<DueDose[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const currentToday = todayIsoDate();
    const { startIso, endIso } = localDayBoundsIso();
    const month = monthBoundsForKey(monthKeyOf(currentToday));

    try {
      // Materializing ahead first keeps the upcoming-bills preview accurate
      // on a fresh install; it is idempotent, so the extra call is cheap.
      await billService.ensureOccurrencesAhead();
      const [
        todaysTasks,
        pendingDueCount,
        overdueCount,
        completedTodayCount,
        bills,
        todayTotals,
        monthTotals,
        accountsWithBalances,
        notes,
        openRequests,
        openRequestTotal,
        prayer,
        prayerSettings,
        allDueDoses,
      ] = await Promise.all([
        service.list({
          status: 'pending',
          dueOnOrBefore: currentToday,
          limit: DASHBOARD_TASK_LIMIT,
        }),
        service.count({ status: 'pending', dueOnOrBefore: currentToday }),
        service.count({ status: 'pending', dueBefore: currentToday }),
        service.countCompletedBetween(startIso, endIso),
        billService.listDue({ limit: DASHBOARD_BILL_LIMIT }),
        transactionService.sumActivity({ fromOn: currentToday, toOn: currentToday }),
        transactionService.sumActivity({ fromOn: month.startOn, toOn: month.lastOn }),
        accountService.listWithBalances(),
        noteService.list({ limit: DASHBOARD_NOTE_LIMIT }),
        familyRequestService.listOutstanding(DASHBOARD_FAMILY_REQUEST_LIMIT),
        familyRequestService.countOutstanding(),
        // Fail-soft: a prayer failure hides the widget instead of the dashboard.
        prayerService.getDay(currentToday).catch(() => null),
        prayerService.getSettings().catch(() => null),
        // Fail-soft: a dose failure hides the section instead of the dashboard.
        medicineService.listDueDoses(currentToday).catch(() => []),
      ]);
      if (requestIdRef.current !== requestId) return;
      setTasks(todaysTasks);
      setUpcomingBills(bills);
      setRecentNotes(notes);
      setOpenFamilyRequests(openRequests);
      setOpenRequestCount(openRequestTotal);
      setPrayerDay(prayer);
      try {
        setPrayerRestricted(
          prayer && prayerSettings
            ? calculateRestrictedWindows(
                prayer.prayers.map(({ prayer: name, time }) => ({ prayer: name, time })),
                calculateSunrise(currentToday, prayerSettings),
              )
            : [],
        );
      } catch {
        setPrayerRestricted([]);
      }
      setDueDoses(allDueDoses.slice(0, DASHBOARD_DOSE_LIMIT));
      setSummary(
        buildDashboardSummary({
          pendingDueCount,
          overdueCount,
          dueTodayCount: Math.max(pendingDueCount - overdueCount, 0),
          completedTodayCount,
        }),
      );
      // Transfers are structurally absent from `sumActivity`, so the month's
      // income/expense totals never include them (rule 11).
      setFinance(
        buildDashboardFinance({
          todayExpenseMinor: todayTotals.expenseMinor,
          monthIncomeMinor: monthTotals.incomeMinor,
          monthExpenseMinor: monthTotals.expenseMinor,
          accountBalances: accountsWithBalances.map((account) => account.balanceMinor),
        }),
      );
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
  }, [service, billService, transactionService, accountService, noteService, familyRequestService, prayerService, medicineService, t]);

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

  const toggleComplete = useCallback(
    async (task: Task) => {
      try {
        await service.setCompleted(task.id, task.status !== 'completed');
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  const toggleNotePin = useCallback(
    async (note: NoteListItem) => {
      try {
        await noteService.setPinned(note.id, !note.isPinned);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [noteService, load, t],
  );

  const logDose = useCallback(
    async (dose: DueDose, status: DoseStatus) => {
      try {
        await medicineService.logDose(dose.scheduleId, dose.date, status);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [medicineService, load, t],
  );

  const clearDose = useCallback(
    async (dose: DueDose) => {
      try {
        await medicineService.clearDose(dose.scheduleId, dose.date);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [medicineService, load, t],
  );

  return {
    summary,
    finance,
    tasks,
    upcomingBills,
    recentNotes,
    openFamilyRequests,
    openRequestCount,
    prayerDay,
    prayerRestricted,
    dueDoses,
    today: todayIsoDate(),
    loading,
    refreshing,
    error,
    notice,
    clearNotice: () => setNotice(null),
    refresh,
    toggleComplete,
    toggleNotePin,
    logDose,
    clearDose,
  };
}
