import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useMemo } from 'react';

import { Banner } from '@/components/banner';
import { Button } from '@/components/button';import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeader } from '@/components/section-header';
import { HeroCard } from '@/features/dashboard/components/hero-card';
import { FinanceSummaryCard } from '@/features/dashboard/components/finance-summary-card';
import { QuickActions } from '@/features/dashboard/components/quick-actions';
import { useDashboard } from '@/features/dashboard/hooks/use-dashboard';
import { PrayerWidget } from '@/features/prayer/components/prayer-widget';
import { OccurrenceCard } from '@/features/bills/components/occurrence-card';
import { RequestCard } from '@/features/family/components/request-card';
import { DoseRow } from '@/features/health/components/dose-row';
import { NoteCard } from '@/features/notes/components/note-card';
import { TaskItem } from '@/features/tasks/components/task-item';
import { buildActiveSections } from '@/features/tasks/grouping';
import { formatIsoDateWeekday, greetingKeyForHour } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { IconSize, Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { ThemeColors } from '@/theme/tokens';
import type { BillDueItem } from '@/types/bill';
import type { Task } from '@/types/task';
import { todayIsoDate } from '@/utils/dates';

export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const {
    summary,
    finance,
    tasks,
    upcomingBills,
    recentNotes,
    openFamilyRequests,
    prayerDay,
    dueDoses,
    today,
    loading,
    refreshing,
    error,
    notice,
    clearNotice,
    refresh,
    toggleComplete,
    toggleNotePin,
    logDose,
    clearDose,
  } = useDashboard();

  function openNewTask() {
    router.push('/task-form');
  }

  function openTask(task: Task) {
    router.push({ pathname: '/task-form', params: { id: task.id } });
  }

  function openAllTasks() {
    router.push('/tasks');
  }

  function openAddIncome() {
    router.push({ pathname: '/transaction-form', params: { kind: 'income' } });
  }

  function openAddExpense() {
    router.push({ pathname: '/transaction-form', params: { kind: 'expense' } });
  }

  function openFinance() {
    router.push('/finance');
  }

  function openPrayer() {
    router.push('/prayer');
  }

  function openHealth() {
    router.push('/health');
  }

  function openBills() {
    router.push('/bills');
  }

  function openNotes() {
    router.push('/notes');
  }

  function openNote(id: string) {
    router.push({ pathname: '/note-form', params: { id } });
  }

  function openAddFamilyRequest() {
    router.push('/request-form');
  }

  function openFamily() {
    router.push('/family');
  }

  function openFamilyRequest(id: string) {
    router.push({ pathname: '/request-form', params: { id } });
  }

  function openBill(bill: BillDueItem) {
    router.push({ pathname: '/bill-detail', params: { id: bill.billId } });
  }

  const greeting = t(greetingKeyForHour(new Date().getHours()));
  const dateLine = formatIsoDateWeekday(todayIsoDate(), t);
  const sections = buildActiveSections(tasks, [], today);

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        kicker={dateLine}
        title={greeting}
        testID="dashboard-header"
        right={
          <Pressable
            onPress={() => router.push('/search')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('search.title')}
            testID="dashboard-search-button"
            style={({ pressed }) => [styles.searchButton, pressed && styles.searchButtonPressed]}>
            <Ionicons name="search" size={IconSize.md} color={colors.text} />
          </Pressable>
        }
      />

      {notice ? (
        <View style={styles.bannerWrapper}>
          <Banner message={notice} onDismiss={clearNotice} />
        </View>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }>
          <HeroCard summary={summary} testID="dashboard-hero" />

          <View style={styles.prayerWrapper}>
            <PrayerWidget
              day={prayerDay}
              onPress={openPrayer}
              testID="dashboard-prayer-widget"
            />
          </View>

          <QuickActions
            onAddTask={openNewTask}
            onAddIncome={openAddIncome}
            onAddExpense={openAddExpense}
            onViewBills={openBills}
            onAddFamilyRequest={openAddFamilyRequest}
            testID="dashboard-quick-actions"
          />

          <View style={styles.financeWrapper}>
            <FinanceSummaryCard
              finance={finance}
              onPress={openFinance}
              testID="dashboard-finance-card"
            />
          </View>

          {dueDoses.length > 0 ? (
            <View>
              <SectionHeader
                title={t('dashboard.todayDoses')}
                count={dueDoses.length}
                testID="dashboard-doses-header"
              />
              <View style={styles.doseList}>
                {dueDoses.map((dose) => (
                  <DoseRow
                    key={`${dose.scheduleId}-${dose.date}`}
                    dose={dose}
                    onLogTaken={(logged) => void logDose(logged, 'taken')}
                    onLogSkipped={(logged) => void logDose(logged, 'skipped')}
                    onClear={(cleared) => void clearDose(cleared)}
                    testID={`dashboard-dose-${dose.scheduleId}`}
                  />
                ))}
              </View>
              <View style={styles.seeAll}>
                <Button
                  label={t('dashboard.healthSeeAll')}
                  variant="ghost"
                  onPress={openHealth}
                  testID="dashboard-see-all-health"
                />
              </View>
            </View>
          ) : null}

          {upcomingBills.length > 0 ? (
            <View>
              <SectionHeader
                title={t('dashboard.upcomingBills')}
                count={upcomingBills.length}
                testID="dashboard-bills-header"
              />
              <View style={styles.billList}>
                {upcomingBills.map((bill) => (
                  <OccurrenceCard
                    key={bill.id}
                    occurrence={bill}
                    category={bill.billCategory}
                    billName={bill.billName}
                    today={today}
                    variant="due"
                    onPress={() => openBill(bill)}
                    testID={`dashboard-bill-${bill.id}`}
                  />
                ))}
              </View>
              <View style={styles.seeAll}>
                <Button
                  label={t('common.seeAll')}
                  variant="ghost"
                  onPress={openBills}
                  testID="dashboard-see-all-bills"
                />
              </View>
            </View>
          ) : null}

          {openFamilyRequests.length > 0 ? (
            <View>
              <SectionHeader
                title={t('dashboard.familyTitle')}
                count={openFamilyRequests.length}
                testID="dashboard-family-header"
              />
              <View style={styles.familyList}>
                {openFamilyRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onPress={() => openFamilyRequest(request.id)}
                    testID={`dashboard-family-request-${request.id}`}
                  />
                ))}
              </View>
              <View style={styles.seeAll}>
                <Button
                  label={t('dashboard.familySeeAll')}
                  variant="ghost"
                  onPress={openFamily}
                  testID="dashboard-see-all-family"
                />
              </View>
            </View>
          ) : null}

          {recentNotes.length > 0 ? (
            <View>
              <SectionHeader
                title={t('dashboard.notesTitle')}
                count={recentNotes.length}
                testID="dashboard-notes-header"
              />
              <View style={styles.noteList}>
                {recentNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onPress={() => openNote(note.id)}
                    onTogglePin={() => void toggleNotePin(note)}
                    testID={`dashboard-note-${note.id}`}
                  />
                ))}
              </View>
              <View style={styles.seeAll}>
                <Button
                  label={t('dashboard.notesSeeAll')}
                  variant="ghost"
                  onPress={openNotes}
                  testID="dashboard-see-all-notes"
                />
              </View>
            </View>
          ) : null}

          {tasks.length > 0 ? (
            <View>
              {sections.map((section) => (
                <View key={section.key}>
                  <SectionHeader
                    title={t(`tasks.sections.${section.key}`)}
                    count={section.data.length}
                    tone={section.tone}
                  />
                  <View style={styles.taskList}>
                    {section.data.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        today={today}
                        onPress={openTask}
                        onToggle={toggleComplete}
                      />
                    ))}
                  </View>
                </View>
              ))}
              <View style={styles.seeAll}>
                <Button
                  label={t('common.seeAll')}
                  variant="ghost"
                  onPress={openAllTasks}
                  testID="dashboard-see-all"
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Fab
        onPress={openNewTask}
        accessibilityLabel={t('tasks.addTaskA11y')}
        testID="dashboard-add-task-fab"
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  bannerWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 96,
    gap: Spacing.xs,
  },
  financeWrapper: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  prayerWrapper: {
    marginTop: Spacing.md,
  },
  taskList: {
    gap: Spacing.sm,
  },
  doseList: {
    gap: Spacing.sm,
  },
  billList: {
    gap: Spacing.sm,
  },
  noteList: {
    gap: Spacing.sm,
  },
  familyList: {
    gap: Spacing.sm,
  },
  seeAll: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
});
