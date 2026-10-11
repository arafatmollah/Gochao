import { router, Stack } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { BudgetRow } from '@/features/finance/components/budget-row';
import { monthKeyLabel } from '@/features/finance/format';
import { useBudgets } from '@/features/finance/hooks/use-budgets';
import { useTranslation } from '@/i18n';
import { Colors, Spacing } from '@/theme/tokens';
import type { BudgetWithUsage } from '@/types/finance';

export default function FinanceBudgetsScreen() {
  const { t, locale } = useTranslation();
  const { budgets, monthKey, loading, refreshing, error, refresh } = useBudgets();

  function openBudget(budget: BudgetWithUsage) {
    router.push({ pathname: '/budget-form', params: { id: budget.id } });
  }

  function openNewBudget() {
    router.push('/budget-form');
  }

  return (
    <>
      <Stack.Screen options={{ title: t('finance.budgets.title') }} />
      <Screen edges={['bottom']}>
        {loading ? (
          <LoadingState label={t('finance.budgets.loading')} />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : (
          <FlatList
            data={budgets}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <BudgetRow budget={item} onPress={() => openBudget(item)} testID={`budget-row-${item.id}`} />
            )}
            ItemSeparatorComponent={ListItemSeparator}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
            ListHeaderComponent={
              <View style={styles.header}>
                <AppText variant="subheading">{monthKeyLabel(monthKey, t, locale)}</AppText>
                <AppText variant="caption" color="textMuted">
                  {t('finance.budgets.hint')}
                </AppText>
              </View>
            }
            ListEmptyComponent={
              <EmptyState
                icon="pie-chart-outline"
                title={t('finance.budgets.emptyTitle')}
                message={t('finance.budgets.emptyMessage')}
                actionLabel={t('finance.budgets.addBudget')}
                onAction={openNewBudget}
              />
            }
          />
        )}

        <Fab
          onPress={openNewBudget}
          accessibilityLabel={t('finance.budgets.addBudgetA11y')}
          testID="add-budget-fab"
        />
      </Screen>
    </>
  );
}

function ListItemSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 96,
    flexGrow: 1,
  },
  separator: {
    height: Spacing.sm,
  },
});
