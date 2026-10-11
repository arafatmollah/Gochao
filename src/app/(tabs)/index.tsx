import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeader } from '@/components/section-header';
import { HeroCard } from '@/features/dashboard/components/hero-card';
import { FinanceSummaryCard } from '@/features/dashboard/components/finance-summary-card';
import { QuickActions } from '@/features/dashboard/components/quick-actions';
import { useDashboard } from '@/features/dashboard/hooks/use-dashboard';
import { OccurrenceCard } from '@/features/bills/components/occurrence-card';
import { TaskItem } from '@/features/tasks/components/task-item';
import { buildActiveSections } from '@/features/tasks/grouping';
import { formatIsoDateWeekday, greetingKeyForHour } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { Colors, Spacing } from '@/theme/tokens';
import type { BillDueItem } from '@/types/bill';
import type { Task } from '@/types/task';
import { todayIsoDate } from '@/utils/dates';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const {
    summary,
    finance,
    tasks,
    upcomingBills,
    today,
    loading,
    refreshing,
    error,
    notice,
    clearNotice,
    refresh,
    toggleComplete,
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

  function openBills() {
    router.push('/bills');
  }

  function openBill(bill: BillDueItem) {
    router.push({ pathname: '/bill-detail', params: { id: bill.billId } });
  }

  const greeting = t(greetingKeyForHour(new Date().getHours()));
  const dateLine = formatIsoDateWeekday(todayIsoDate(), t);
  const sections = buildActiveSections(tasks, [], today);

  return (
    <Screen edges={['top']}>
      <ScreenHeader kicker={dateLine} title={greeting} testID="dashboard-header" />

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
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }>
          <HeroCard summary={summary} testID="dashboard-hero" />

          <QuickActions
            onAddTask={openNewTask}
            onAddIncome={openAddIncome}
            onAddExpense={openAddExpense}
            onViewBills={openBills}
            testID="dashboard-quick-actions"
          />

          <View style={styles.financeWrapper}>
            <FinanceSummaryCard
              finance={finance}
              onPress={openFinance}
              testID="dashboard-finance-card"
            />
          </View>

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
          ) : (
            <Card style={styles.emptyCard}>
              <EmptyState
                icon="checkbox-outline"
                title={t('dashboard.nothingDueTitle')}
                message={t('dashboard.nothingDueMessage')}
                actionLabel={t('dashboard.addTask')}
                onAction={openNewTask}
              />
            </Card>
          )}
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

const styles = StyleSheet.create({
  bannerWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
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
  taskList: {
    gap: Spacing.sm,
  },
  billList: {
    gap: Spacing.sm,
  },
  seeAll: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  emptyCard: {
    paddingVertical: Spacing.sm,
  },
});
