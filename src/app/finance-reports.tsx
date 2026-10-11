import { router, Stack } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { AccountRow } from '@/features/finance/components/account-row';
import { BudgetRow } from '@/features/finance/components/budget-row';
import { SavingsChart } from '@/features/finance/components/savings-chart';
import { REPORT_RANGES, useFinanceReports } from '@/features/finance/hooks/use-finance-reports';
import { categoryDisplayName } from '@/features/finance/meta';
import { useTranslation } from '@/i18n';
import { formatMoney } from '@/i18n/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';
import type { CategoryTotal } from '@/types/finance';

export default function FinanceReportsScreen() {
  const { t, locale } = useTranslation();
  const reports = useFinanceReports();

  if (reports.loading) {
    return (
      <>
        <Stack.Screen options={{ title: t('finance.reports.title') }} />
        <Screen edges={['bottom']}>
          <LoadingState label={t('finance.reports.loading')} />
        </Screen>
      </>
    );
  }

  if (reports.error) {
    return (
      <>
        <Stack.Screen options={{ title: t('finance.reports.title') }} />
        <Screen edges={['bottom']}>
          <ErrorState message={reports.error} onRetry={reports.refresh} />
        </Screen>
      </>
    );
  }

  const largest = reports.expenseByCategory.slice(0, 3);
  const largestMax = Math.max(1, ...largest.map((item) => item.totalMinor));

  return (
    <>
      <Stack.Screen options={{ title: t('finance.reports.title') }} />
      <Screen edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={reports.refreshing}
              onRefresh={reports.refresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }>
          {!reports.hasData ? (
            <EmptyState
              icon="stats-chart-outline"
              title={t('finance.reports.emptyTitle')}
              message={t('finance.reports.emptyMessage')}
              testID="reports-empty"
            />
          ) : (
            <>
              <View style={styles.rangeRow}>
                {REPORT_RANGES.map((range) => (
                  <Chip
                    key={range}
                    label={t(`finance.reports.range.${range}`)}
                    selected={reports.range === range}
                    onPress={() => reports.setRange(range)}
                    testID={`report-range-${range}`}
                  />
                ))}
              </View>

              <Card testID="reports-summary">
                <View style={styles.summaryRow}>
                  <View style={styles.summaryColumn}>
                    <AppText variant="caption" color="textSecondary">
                      {t('finance.reports.incomeLabel')}
                    </AppText>
                    <AppText variant="bodyStrong" color="success" numberOfLines={1}>
                      {formatMoney(reports.totals.incomeMinor, locale)}
                    </AppText>
                  </View>
                  <View style={styles.summaryColumn}>
                    <AppText variant="caption" color="textSecondary">
                      {t('finance.reports.expenseLabel')}
                    </AppText>
                    <AppText variant="bodyStrong" color="danger" numberOfLines={1}>
                      {formatMoney(reports.totals.expenseMinor, locale)}
                    </AppText>
                  </View>
                  <View style={styles.summaryColumn}>
                    <AppText variant="caption" color="textSecondary">
                      {t('finance.reports.netLabel')}
                    </AppText>
                    <AppText
                      variant="bodyStrong"
                      color={reports.totals.netMinor < 0 ? 'danger' : 'success'}
                      numberOfLines={1}>
                      {formatMoney(reports.totals.netMinor, locale)}
                    </AppText>
                  </View>
                </View>
              </Card>

              {largest.length > 0 ? (
                <View style={styles.section}>
                  <AppText variant="subheading">{t('finance.reports.largestTitle')}</AppText>
                  {largest.map((item) => (
                    <View key={item.categoryId} style={styles.categoryBlock}>
                      <View style={styles.categoryLine}>
                        <AppText variant="body" numberOfLines={1} style={styles.categoryName}>
                          {categoryDisplayName(
                            {
                              id: item.categoryId,
                              name: item.categoryName,
                              isBuiltin: item.categoryIsBuiltin,
                            },
                            t,
                          )}
                        </AppText>
                        <AppText variant="bodyStrong" numberOfLines={1}>
                          {formatMoney(item.totalMinor, locale)}
                        </AppText>
                      </View>
                      <View style={styles.track}>
                        <View
                          style={[
                            styles.fill,
                            {
                              backgroundColor: Colors.primary,
                              width: `${Math.round((item.totalMinor / largestMax) * 100)}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.section}>
                <AppText variant="subheading">{t('finance.reports.byCategoryTitle')}</AppText>
                <AppText variant="caption" color="textMuted">
                  {t('finance.reports.byCategoryHint')}
                </AppText>
                {reports.expenseByCategory.length === 0 ? (
                  <AppText variant="caption" color="textMuted">
                    {t('finance.reports.noExpenses')}
                  </AppText>
                ) : (
                  <Card>
                    {reports.expenseByCategory.map((item, index) => (
                      <CategoryLine
                        key={item.categoryId}
                        item={item}
                        totalMinor={reports.totals.expenseMinor}
                        first={index === 0}
                      />
                    ))}
                  </Card>
                )}
              </View>

              <View style={styles.section}>
                <AppText variant="subheading">{t('finance.reports.savingsTitle')}</AppText>
                <AppText variant="caption" color="textMuted">
                  {t('finance.reports.savingsHint')}
                </AppText>
                <Card>
                  <SavingsChart series={reports.savingsSeries} testID="reports-savings-chart" />
                </Card>
              </View>

              <View style={styles.section}>
                <AppText variant="subheading">{t('finance.reports.budgetTitle')}</AppText>
                <AppText variant="caption" color="textMuted">
                  {t('finance.reports.budgetHint')}
                </AppText>
                {reports.budgetUsage.length === 0 ? (
                  <AppText variant="caption" color="textMuted">
                    {t('finance.reports.noBudgets')}
                  </AppText>
                ) : (
                  reports.budgetUsage.map((budget) => (
                    <BudgetRow
                      key={budget.id}
                      budget={budget}
                      onPress={() =>
                        router.push({ pathname: '/budget-form', params: { id: budget.id } })
                      }
                      testID={`report-budget-${budget.id}`}
                    />
                  ))
                )}
              </View>

              <View style={styles.section}>
                <AppText variant="subheading">{t('finance.reports.balanceTitle')}</AppText>
                <AppText variant="caption" color="textMuted">
                  {t('finance.reports.balanceHint')}
                </AppText>
                {reports.accountBalances.length === 0 ? (
                  <AppText variant="caption" color="textMuted">
                    {t('finance.reports.noAccounts')}
                  </AppText>
                ) : (
                  reports.accountBalances.map((account) => (
                    <AccountRow key={account.id} account={account} testID={`report-account-${account.id}`} />
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      </Screen>
    </>
  );
}

function CategoryLine({
  item,
  totalMinor,
  first,
}: {
  item: CategoryTotal;
  totalMinor: number;
  first: boolean;
}) {
  const { t, locale } = useTranslation();
  const share = totalMinor > 0 ? Math.round((item.totalMinor / totalMinor) * 100) : 0;

  return (
    <View style={[styles.categoryLine, !first && styles.categoryLineBordered]}>
      <AppText variant="body" numberOfLines={1} style={styles.categoryName}>
        {categoryDisplayName(
          { id: item.categoryId, name: item.categoryName, isBuiltin: item.categoryIsBuiltin },
          t,
        )}
      </AppText>
      <AppText variant="caption" color="textMuted">
        {`${share}%`}
      </AppText>
      <AppText variant="bodyStrong" numberOfLines={1}>
        {formatMoney(item.totalMinor, locale)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    flexGrow: 1,
  },
  rangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  summaryColumn: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: Spacing.sm,
  },
  categoryBlock: {
    gap: Spacing.xs,
  },
  categoryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  categoryLineBordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
  },
  categoryName: {
    flex: 1,
  },
  track: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
});
