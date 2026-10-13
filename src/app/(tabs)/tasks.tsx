import { router } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useMemo } from 'react';

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
import { TaskItem } from '@/features/tasks/components/task-item';
import type { TaskSection } from '@/features/tasks/grouping';
import { useTasks } from '@/features/tasks/hooks/use-tasks';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { ThemeColors } from '@/theme/tokens';
import type { Task, TaskPriority } from '@/types/task';

interface PriorityFilterOption {
  value: TaskPriority | null;
  labelKey: string;
}

const PRIORITY_FILTERS: PriorityFilterOption[] = [
  { value: null, labelKey: 'tasks.filters.anyPriority' },
  { value: 'high', labelKey: 'priority.high' },
  { value: 'medium', labelKey: 'priority.medium' },
  { value: 'low', labelKey: 'priority.low' },
];

export default function TasksScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const {
    sections,
    activeCount,
    overdueCount,
    today,
    loading,
    refreshing,
    loadingMore,
    error,
    notice,
    clearNotice,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    search,
    setSearch,
    refresh,
    loadMore,
    toggleComplete,
  } = useTasks();

  function openNewTask() {
    router.push('/task-form');
  }

  function openTask(task: Task) {
    router.push({ pathname: '/task-form', params: { id: task.id } });
  }

  function clearFilters() {
    setSearch('');
    setPriorityFilter(null);
  }

  const hasFilters = search.trim().length > 0 || priorityFilter !== null;
  const completedCount = sections
    .filter((section) => section.key === 'recent-completed' || section.key === 'completed')
    .reduce((total, section) => total + section.data.length, 0);

  const subtitle =
    statusFilter === 'active'
      ? overdueCount > 0
        ? t('tasks.activeWithOverdue', { count: activeCount, overdue: overdueCount })
        : t('tasks.activeCount', { count: activeCount })
      : t('tasks.completedCount', { count: completedCount });

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        kicker={subtitle}
        kickerTone={overdueCount > 0 && statusFilter === 'active' ? 'danger' : 'default'}
        title={t('tasks.title')}
        testID="tasks-header"
      />

      {notice ? (
        <View style={styles.bannerWrapper}>
          <Banner message={notice} onDismiss={clearNotice} />
        </View>
      ) : null}

      <View style={styles.controls}>
        <SearchField value={search} onChangeText={setSearch} testID="task-search" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled">
          <Chip
            label={t('tasks.filters.active')}
            selected={statusFilter === 'active'}
            onPress={() => setStatusFilter('active')}
            testID="filter-active"
          />
          <Chip
            label={t('tasks.filters.completed')}
            selected={statusFilter === 'completed'}
            onPress={() => setStatusFilter('completed')}
            testID="filter-completed"
          />
          <View style={styles.chipDivider} />
          {PRIORITY_FILTERS.map((option) => (
            <Chip
              key={option.labelKey}
              label={t(option.labelKey)}
              selected={priorityFilter === option.value}
              onPress={() => setPriorityFilter(option.value)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <LoadingState label={t('tasks.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <SectionList<Task, TaskSection>
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskItem task={item} today={today} onPress={openTask} onToggle={toggleComplete} />
          )}
          renderSectionHeader={({ section }) => (
            <SectionHeader
              title={t(`tasks.sections.${section.key}`)}
              count={section.data.length}
              tone={section.tone}
            />
          )}
          ItemSeparatorComponent={ListItemSeparator}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          onEndReached={statusFilter === 'completed' ? loadMore : undefined}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={hasFilters ? 'search-outline' : 'checkbox-outline'}
              title={
                hasFilters
                  ? t('tasks.noMatchesTitle')
                  : statusFilter === 'completed'
                    ? t('tasks.nothingCompletedTitle')
                    : t('tasks.emptyTitle')
              }
              message={
                hasFilters
                  ? t('tasks.noMatchesMessage')
                  : statusFilter === 'completed'
                    ? t('tasks.nothingCompletedMessage')
                    : t('tasks.emptyMessage')
              }
              actionLabel={
                hasFilters
                  ? t('tasks.filters.clearFilters')
                  : statusFilter === 'active'
                    ? t('tasks.addTask')
                    : undefined
              }
              onAction={hasFilters ? clearFilters : statusFilter === 'active' ? openNewTask : undefined}
            />
          }
        />
      )}

      <Fab onPress={openNewTask} accessibilityLabel={t('tasks.addTaskA11y')} testID="add-task-fab" />
    </Screen>
  );
}

function ListItemSeparator() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.separator} />;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  bannerWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
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
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.borderStrong,
    marginHorizontal: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 96,
    flexGrow: 1,
  },
  separator: {
    height: Spacing.sm,
  },
  footer: {
    paddingVertical: Spacing.lg,
  },
});
