import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useMemo } from 'react';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { ActivityRowItem } from '@/features/finance/components/activity-row';
import {
  useTransactions,
  type ActivityKindFilter,
  type ActivityMonthSection,
} from '@/features/finance/hooks/use-transactions';
import { monthKeyLabel } from '@/features/finance/format';
import { formatMoney } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { IconSize, Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { ThemeColors } from '@/theme/tokens';
import type { ActivityRow } from '@/types/finance';

const KIND_FILTERS: ActivityKindFilter[] = ['all', 'income', 'expense', 'transfer'];

export default function FinanceTransactionsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const {
    kind,
    setKind,
    search,
    setSearch,
    filtersActive,
    clearFilters,
    sections,
    loadedCount,
    today,
    loading,
    refreshing,
    error,
    refresh,
  } = useTransactions();

  function openRow(row: ActivityRow) {
    if (row.kind === 'transfer') {
      router.push({ pathname: '/finance-transfer', params: { id: row.id } });
      return;
    }
    router.push({ pathname: '/transaction-form', params: { id: row.id } });
  }

  const showNoMatches = filtersActive && loadedCount > 0 && sections.length === 0;

  return (
    <>
      <Stack.Screen options={{ title: t('finance.transactions.title') }} />
      <Screen edges={['bottom']}>
        <View style={styles.toolbar}>
          <SearchField
            value={search}
            onChangeText={setSearch}
            placeholder={t('finance.transactions.searchPlaceholder')}
            testID="transactions-search"
          />
          <View style={styles.filterRow}>
            {KIND_FILTERS.map((value) => (
              <Chip
                key={value}
                label={
                  value === 'all'
                    ? t('finance.transactions.filtersAll')
                    : t(`finance.kind.${value}`)
                }
                selected={kind === value}
                onPress={() => setKind(value)}
                testID={`transactions-filter-${value}`}
              />
            ))}
          </View>
          <View style={styles.addRow}>
            <Button
              label={t('finance.transactions.addIncome')}
              variant="secondary"
              size="sm"
              icon={<Ionicons name="arrow-down-circle-outline" size={IconSize.sm} color={colors.success} />}
              onPress={() =>
                router.push({ pathname: '/transaction-form', params: { kind: 'income' } })
              }
              testID="transactions-add-income"
            />
            <Button
              label={t('finance.transactions.addExpense')}
              variant="secondary"
              size="sm"
              icon={<Ionicons name="arrow-up-circle-outline" size={IconSize.sm} color={colors.danger} />}
              onPress={() =>
                router.push({ pathname: '/transaction-form', params: { kind: 'expense' } })
              }
              testID="transactions-add-expense"
            />
          </View>
        </View>

        {loading ? (
          <LoadingState label={t('finance.transactions.loading')} />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : (
          <SectionList<ActivityRow, ActivityMonthSection>
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ActivityRowItem
                row={item}
                today={today}
                onPress={() => openRow(item)}
                testID={`activity-row-${item.id}`}
              />
            )}
            renderSectionHeader={({ section }) => (
              <MonthHeader section={section} />
            )}
            ItemSeparatorComponent={ListItemSeparator}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={
              showNoMatches ? (
                <EmptyState
                  icon="search-outline"
                  title={t('finance.transactions.noMatchesTitle')}
                  message={t('finance.transactions.noMatchesMessage')}
                  actionLabel={t('finance.transactions.clearFilters')}
                  onAction={clearFilters}
                  testID="transactions-no-matches"
                />
              ) : (
                <EmptyState
                  icon="swap-horizontal-outline"
                  title={t('finance.transactions.emptyTitle')}
                  message={t('finance.transactions.emptyMessage')}
                  actionLabel={t('finance.transactions.addExpense')}
                  onAction={() =>
                    router.push({ pathname: '/transaction-form', params: { kind: 'expense' } })
                  }
                  testID="transactions-empty"
                />
              )
            }
          />
        )}
      </Screen>
    </>
  );
}

/** Month label plus that month's income/expense subtotals. */
function MonthHeader({ section }: { section: ActivityMonthSection }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, locale } = useTranslation();
  return (
    <View style={styles.monthHeader}>
      <AppText variant="label" color="textSecondary">
        {monthKeyLabel(section.key, t, locale)}
      </AppText>
      <View style={styles.monthTotals}>
        {section.incomeMinor > 0 ? (
          <AppText variant="caption" style={{ color: colors.success }}>
            {t('finance.transactions.incomeSummary', {
              amount: formatMoney(section.incomeMinor, locale),
            })}
          </AppText>
        ) : null}
        {section.expenseMinor > 0 ? (
          <AppText variant="caption" style={{ color: colors.danger }}>
            {t('finance.transactions.expenseSummary', {
              amount: formatMoney(section.expenseMinor, locale),
            })}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function ListItemSeparator() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.separator} />;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  toolbar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    flexGrow: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: colors.background,
  },
  monthTotals: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  separator: {
    height: Spacing.sm,
  },
});
