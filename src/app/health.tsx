import { router } from 'expo-router';
import { FlatList, ScrollView, SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SearchField } from '@/components/search-field';
import { SectionHeader } from '@/components/section-header';
import { DoseRow } from '@/features/health/components/dose-row';
import { MedicineRow } from '@/features/health/components/medicine-row';
import { AppointmentRow, HealthNoteCard } from '@/features/health/components/visit-note-rows';
import {
  useHealth,
  type HealthSegment,
  type MedicineWithAdherence,
} from '@/features/health/hooks/use-health';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';
import { MEDICINE_FREQUENCIES, type Appointment, type DueDose, type HealthRecord, type MedicineFrequency, type MedicineWithSchedules } from '@/types/health';

const SEGMENTS: HealthSegment[] = ['today', 'medicines', 'visits', 'notes'];

export default function HealthScreen() {
  const { t } = useTranslation();
  const {
    segment,
    setSegment,
    doses,
    remainingDoses,
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
    clearNotice,
    refresh,
    logDose,
    clearDose,
  } = useHealth();

  function openMedicineForm(id?: string) {
    if (id) {
      router.push({ pathname: '/medicine-form', params: { id } });
    } else {
      router.push('/medicine-form');
    }
  }

  function openVisitForm(id?: string) {
    if (id) {
      router.push({ pathname: '/appointment-form', params: { id } });
    } else {
      router.push('/appointment-form');
    }
  }

  function openNoteForm(id?: string) {
    if (id) {
      router.push({ pathname: '/health-note-form', params: { id } });
    } else {
      router.push('/health-note-form');
    }
  }

  function openFab() {
    if (segment === 'visits') {
      openVisitForm();
    } else if (segment === 'notes') {
      openNoteForm();
    } else {
      openMedicineForm();
    }
  }

  function fabLabel(): string {
    if (segment === 'visits') {
      return t('health.addVisitA11y');
    }
    if (segment === 'notes') {
      return t('health.addNoteA11y');
    }
    return t('health.addMedicineA11y');
  }

  const kicker =
    segment === 'today'
      ? remainingDoses === 0
        ? t('health.allDosesLogged')
        : t('health.dosesRemaining', { count: remainingDoses })
      : undefined;

  function goBack() {
    // The native header is hidden (custom ScreenHeader instead), so the
    // screen owns its back affordance. Deep links may have no history.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/more');
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        kicker={kicker}
        title={t('health.title')}
        onBack={goBack}
        testID="health-header"
      />
      <View style={styles.disclaimerWrapper}>
        <AppText variant="caption" color="textMuted">
          {t('health.disclaimer')}
        </AppText>
      </View>

      {notice ? (
        <View style={styles.bannerWrapper}>
          <Banner message={notice} onDismiss={clearNotice} />
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segmentRow}
        keyboardShouldPersistTaps="handled">
        {SEGMENTS.map((value) => (
          <Chip
            key={value}
            label={t(`health.segments.${value}`)}
            selected={segment === value}
            onPress={() => setSegment(value)}
            testID={`health-segment-${value}`}
          />
        ))}
      </ScrollView>

      {loading ? (
        <LoadingState label={t('health.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : segment === 'today' ? (
        <TodayList
          doses={doses}
          refreshing={refreshing}
          onRefresh={refresh}
          onLogTaken={(dose) => void logDose(dose, 'taken')}
          onLogSkipped={(dose) => void logDose(dose, 'skipped')}
          onClear={clearDose}
          onAddMedicine={() => openMedicineForm()}
        />
      ) : segment === 'medicines' ? (
        <MedicineList
          medicines={medicines}
          search={search}
          onSearch={setSearch}
          archivedFilter={archivedFilter}
          onArchivedFilter={setArchivedFilter}
          frequencyFilter={frequencyFilter}
          onFrequencyFilter={setFrequencyFilter}
          refreshing={refreshing}
          onRefresh={refresh}
          onOpen={(medicine) => openMedicineForm(medicine.id)}
          onAdd={() => openMedicineForm()}
        />
      ) : segment === 'visits' ? (
        <VisitList
          upcoming={upcomingVisits}
          past={pastVisits}
          refreshing={refreshing}
          onRefresh={refresh}
          onOpen={(visit) => openVisitForm(visit.id)}
          onAdd={() => openVisitForm()}
        />
      ) : (
        <NoteList
          notes={notes}
          refreshing={refreshing}
          onRefresh={refresh}
          onOpen={(note) => openNoteForm(note.id)}
          onAdd={() => openNoteForm()}
        />
      )}

      <Fab onPress={openFab} accessibilityLabel={fabLabel()} testID="add-health-fab" />
    </Screen>
  );
}

function TodayList({
  doses,
  refreshing,
  onRefresh,
  onLogTaken,
  onLogSkipped,
  onClear,
  onAddMedicine,
}: {
  doses: DueDose[];
  refreshing: boolean;
  onRefresh: () => void;
  onLogTaken: (dose: DueDose) => void;
  onLogSkipped: (dose: DueDose) => void;
  onClear: (dose: DueDose) => void;
  onAddMedicine: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FlatList
      data={doses}
      keyExtractor={(item) => `${item.scheduleId}-${item.date}`}
      renderItem={({ item }) => (
        <DoseRow
          dose={item}
          onLogTaken={onLogTaken}
          onLogSkipped={onLogSkipped}
          onClear={onClear}
          testID={`dose-${item.scheduleId}`}
        />
      )}
      ItemSeparatorComponent={ListItemSeparator}
      contentContainerStyle={styles.listContent}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={
        <EmptyState
          icon="medkit-outline"
          title={t('health.todayEmptyTitle')}
          message={t('health.todayEmptyMessage')}
          actionLabel={t('health.addMedicine')}
          onAction={onAddMedicine}
        />
      }
    />
  );
}

function MedicineList({
  medicines,
  search,
  onSearch,
  archivedFilter,
  onArchivedFilter,
  frequencyFilter,
  onFrequencyFilter,
  refreshing,
  onRefresh,
  onOpen,
  onAdd,
}: {
  medicines: MedicineWithAdherence[];
  search: string;
  onSearch: (value: string) => void;
  archivedFilter: boolean;
  onArchivedFilter: (value: boolean) => void;
  frequencyFilter: MedicineFrequency | null;
  onFrequencyFilter: (value: MedicineFrequency | null) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (medicine: MedicineWithSchedules) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const filtering = search.trim().length > 0 || frequencyFilter !== null;
  return (
    <View style={styles.flex}>
      <View style={styles.controls}>
        <SearchField
          value={search}
          onChangeText={onSearch}
          placeholder={t('health.searchPlaceholder')}
          testID="health-medicine-search"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled">
          <Chip
            label={t('health.filters.active')}
            selected={!archivedFilter}
            onPress={() => onArchivedFilter(false)}
            testID="health-filter-active"
          />
          <Chip
            label={t('health.filters.archived')}
            selected={archivedFilter}
            onPress={() => onArchivedFilter(true)}
            testID="health-filter-archived"
          />
          {MEDICINE_FREQUENCIES.map((frequency) => (
            <Chip
              key={frequency}
              label={t(`health.frequencies.${frequency}`)}
              selected={frequencyFilter === frequency}
              onPress={() => onFrequencyFilter(frequencyFilter === frequency ? null : frequency)}
              testID={`health-frequency-${frequency}`}
            />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={medicines}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MedicineRow medicine={item} onPress={onOpen} testID={`medicine-${item.id}`} />
        )}
        ItemSeparatorComponent={ListItemSeparator}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <EmptyState
            icon="medkit-outline"
            title={t('health.medicinesEmptyTitle')}
            message={t('health.medicinesEmptyMessage')}
            actionLabel={filtering || archivedFilter ? undefined : t('health.addMedicine')}
            onAction={filtering || archivedFilter ? undefined : onAdd}
          />
        }
      />
    </View>
  );
}

function VisitList({
  upcoming,
  past,
  refreshing,
  onRefresh,
  onOpen,
  onAdd,
}: {
  upcoming: Appointment[];
  past: Appointment[];
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (visit: Appointment) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const sections = [
    { key: 'upcoming', title: t('health.upcomingTitle'), data: upcoming },
    { key: 'past', title: t('health.pastTitle'), data: past },
  ].filter((section) => section.data.length > 0);
  return (
    <SectionList<Appointment, { key: string; title: string; data: Appointment[] }>
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <AppointmentRow appointment={item} onPress={onOpen} testID={`visit-${item.id}`} />
      )}
      renderSectionHeader={({ section }) => (
        <SectionHeader
          title={section.title}
          count={section.data.length}
          style={section.key === sections[0]?.key ? styles.firstSectionHeader : undefined}
        />
      )}
      ItemSeparatorComponent={ListItemSeparator}
      contentContainerStyle={styles.listContent}
      stickySectionHeadersEnabled={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={
        <EmptyState
          icon="calendar-outline"
          title={t('health.visitsEmptyTitle')}
          message={t('health.visitsEmptyMessage')}
          actionLabel={t('health.addVisit')}
          onAction={onAdd}
        />
      }
    />
  );
}

function NoteList({
  notes,
  refreshing,
  onRefresh,
  onOpen,
  onAdd,
}: {
  notes: HealthRecord[];
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (note: HealthRecord) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FlatList
      data={notes}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <HealthNoteCard record={item} onPress={onOpen} testID={`health-note-${item.id}`} />
      )}
      ItemSeparatorComponent={ListItemSeparator}
      contentContainerStyle={styles.listContent}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={
        <EmptyState
          icon="document-text-outline"
          title={t('health.notesEmptyTitle')}
          message={t('health.notesEmptyMessage')}
          actionLabel={t('health.addNote')}
          onAction={onAdd}
        />
      }
    />
  );
}

function ListItemSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  disclaimerWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  bannerWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  segmentRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  controls: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  chipRow: {
    gap: Spacing.sm,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 96,
    paddingTop: 0,
    flexGrow: 1,
  },
  /** First section opens the list: no extra top pad (matches flat lists). */
  firstSectionHeader: {
    paddingTop: 0,
  },
  separator: {
    height: Spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
