import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  SqliteAppointmentRepository,
  SqliteHealthRecordRepository,
  SqliteMedicineRepository,
} from '@/db/repositories/health-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createAppointmentService } from '@/services/appointment-service';
import { createHealthRecordService } from '@/services/health-record-service';
import { createMedicineService } from '@/services/medicine-service';
import type {
  Appointment,
  DoseStatus,
  DueDose,
  HealthRecord,
  MedicineFrequency,
  MedicineWithSchedules,
} from '@/types/health';
import { addDaysIsoDate, todayIsoDate } from '@/utils/dates';

import { useDebouncedValue } from '@/hooks/use-debounced-value';

export type HealthSegment = 'today' | 'medicines' | 'visits' | 'notes';

/** Adherence window for the "taken this week" counts. */
const ADHERENCE_DAYS = 7;

export interface MedicineWithAdherence extends MedicineWithSchedules {
  takenThisWeek: number;
  totalThisWeek: number;
}

export interface UseHealthResult {
  segment: HealthSegment;
  setSegment: (segment: HealthSegment) => void;
  today: string;

  doses: DueDose[];
  remainingDoses: number;
  medicines: MedicineWithAdherence[];
  upcomingVisits: Appointment[];
  pastVisits: Appointment[];
  notes: HealthRecord[];

  search: string;
  setSearch: (search: string) => void;
  archivedFilter: boolean;
  setArchivedFilter: (archived: boolean) => void;
  frequencyFilter: MedicineFrequency | null;
  setFrequencyFilter: (frequency: MedicineFrequency | null) => void;

  loading: boolean;
  refreshing: boolean;
  /** Screen-level failure (replaces the content with an error state). */
  error: string | null;
  /** Transient message from a failed action, shown as a banner. */
  notice: string | null;
  clearNotice: () => void;
  refresh: () => void;
  logDose: (dose: DueDose, status: DoseStatus) => Promise<void>;
  clearDose: (dose: DueDose) => Promise<void>;
}

export function useHealth(): UseHealthResult {
  const db = useSQLiteContext();
  const sql = useMemo(() => toSqlDatabase(db), [db]);
  const medicineService = useMemo(() => createMedicineService(new SqliteMedicineRepository(sql)), [sql]);
  const appointmentService = useMemo(
    () => createAppointmentService(new SqliteAppointmentRepository(sql)),
    [sql],
  );
  const recordService = useMemo(
    () => createHealthRecordService(new SqliteHealthRecordRepository(sql)),
    [sql],
  );
  const { t } = useTranslation();

  const [segment, setSegment] = useState<HealthSegment>('today');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [archivedFilter, setArchivedFilter] = useState(false);
  const [frequencyFilter, setFrequencyFilter] = useState<MedicineFrequency | null>(null);

  const [doses, setDoses] = useState<DueDose[]>([]);
  const [medicines, setMedicines] = useState<MedicineWithAdherence[]>([]);
  const [upcomingVisits, setUpcomingVisits] = useState<Appointment[]>([]);
  const [pastVisits, setPastVisits] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<HealthRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Guards against out-of-order responses when filters change rapidly. */
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const today = todayIsoDate();
    try {
      const [dueDoses, listed, adherence, upcoming, past, records] = await Promise.all([
        medicineService.listDueDoses(today),
        medicineService.list({
          archived: archivedFilter,
          search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
        }),
        medicineService.adherenceSince(addDaysIsoDate(today, -(ADHERENCE_DAYS - 1))),
        appointmentService.listUpcoming(today),
        appointmentService.listPast(today),
        recordService.list(),
      ]);
      if (requestIdRef.current !== requestId) return;
      const adherenceByMedicine = new Map(
        adherence.map((entry) => [entry.medicineId, entry]),
      );
      setDoses(dueDoses);
      setMedicines(
        listed
          .filter((medicine) => frequencyFilter === null || medicine.frequency === frequencyFilter)
          .map((medicine) => {
            const counts = adherenceByMedicine.get(medicine.id);
            return {
              ...medicine,
              takenThisWeek: counts?.taken ?? 0,
              totalThisWeek: counts?.total ?? 0,
            };
          }),
      );
      setUpcomingVisits(upcoming);
      setPastVisits(past);
      setNotes(records);
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
  }, [
    medicineService,
    appointmentService,
    recordService,
    archivedFilter,
    debouncedSearch,
    frequencyFilter,
    t,
  ]);

  // Reloads on every focus (initial mount included), so the view is fresh
  // when returning from the add/edit modals.
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
    segment,
    setSegment,
    today: todayIsoDate(),
    doses,
    remainingDoses: doses.filter((dose) => dose.status === null).length,
    medicines,
    upcomingVisits,
    pastVisits,
    notes,
    search,
    setSearch,
    archivedFilter,
    setArchivedFilter,
    frequencyFilter,
    setFrequencyFilter,
    loading,
    refreshing,
    error,
    notice,
    clearNotice: () => setNotice(null),
    refresh,
    logDose,
    clearDose,
  };
}
