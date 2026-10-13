import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeader } from '@/components/section-header';
import { AccountRow } from '@/features/finance/components/account-row';
import { ActivityRowItem } from '@/features/finance/components/activity-row';
import { BalanceCard } from '@/features/finance/components/balance-card';
import { FinanceQuickActions } from '@/features/finance/components/finance-quick-actions';
import { useFinanceOverview } from '@/features/finance/hooks/use-finance-overview';
import { useTranslation } from '@/i18n';
import { IconSize, Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { ActivityRow } from '@/types/finance';
import { todayIsoDate } from '@/utils/dates';

const ACCOUNTS_PREVIEW = 3;

export default function FinanceScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { accounts, totalBalanceMinor, monthTotals, recent, loading, refreshing, error, refresh } =
    useFinanceOverview();
  const today = todayIsoDate();

  function openActivity(row: ActivityRow) {
    if (row.kind === 'transfer') {
      router.push({ pathname: '/finance-transfer', params: { id: row.id } });
      return;
    }
    router.push({ pathname: '/transaction-form', params: { id: row.id } });
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        kicker={t('finance.overview.kicker')}
        title={t('finance.title')}
        right={
          <Pressable
            onPress={() => router.push('/finance-accounts')}
            accessibilityRole="button"
            accessibilityLabel={t('finance.overview.manage')}
            testID="finance-manage-accounts">
            <AppText variant="label" color="primary">
              {t('finance.overview.manage')}
            </AppText>
          </Pressable>
        }
        testID="finance-header"
      />

      {loading ? (
        <LoadingState label={t('finance.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }>
          <BalanceCard totalBalanceMinor={totalBalanceMinor} monthTotals={monthTotals} testID="finance-balance-card" />

          <FinanceQuickActions
            onAddIncome={() =>
              router.push({ pathname: '/transaction-form', params: { kind: 'income' } })
            }
            onAddExpense={() =>
              router.push({ pathname: '/transaction-form', params: { kind: 'expense' } })
            }
            onTransfer={() => router.push('/finance-transfer')}
            onReports={() => router.push('/finance-reports')}
          />

          <SectionHeader
            title={t('finance.overview.accountsTitle')}
            count={accounts.length}
            testID="finance-accounts-header"
          />
          {accounts.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title={t('finance.overview.noAccountsTitle')}
              message={t('finance.overview.noAccountsMessage')}
              actionLabel={t('finance.overview.addAccount')}
              onAction={() => router.push('/account-form')}
              testID="finance-accounts-empty"
            />
          ) : (
            <View style={styles.list}>
              {accounts.slice(0, ACCOUNTS_PREVIEW).map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onPress={() => router.push({ pathname: '/account-form', params: { id: account.id } })}
                  testID={`finance-account-${account.id}`}
                />
              ))}
              {accounts.length > ACCOUNTS_PREVIEW ? (
                <Button
                  label={t('common.seeAll')}
                  variant="secondary"
                  onPress={() => router.push('/finance-accounts')}
                  testID="finance-see-all-accounts"
                />
              ) : null}
            </View>
          )}

          <SectionHeader
            title={t('finance.overview.recentTitle')}
            count={recent.length}
            testID="finance-recent-header"
          />
          {recent.length === 0 ? (
            <EmptyState
              icon="swap-horizontal-outline"
              title={t('finance.overview.recentEmptyTitle')}
              message={t('finance.overview.recentEmptyMessage')}
              testID="finance-recent-empty"
            />
          ) : (
            <View style={styles.list}>
              {recent.map((row) => (
                <ActivityRowItem
                  key={row.id}
                  row={row}
                  today={today}
                  onPress={() => openActivity(row)}
                  testID={`finance-activity-${row.id}`}
                />
              ))}
              <Button
                label={t('finance.overview.allTransactions')}
                variant="secondary"
                onPress={() => router.push('/finance-transactions')}
                testID="finance-all-transactions"
              />
            </View>
          )}

          <View style={styles.links}>
            <LinkRow
              icon="pie-chart-outline"
              label={t('finance.overview.budgets')}
              onPress={() => router.push('/finance-budgets')}
              testID="finance-link-budgets"
            />
            <LinkRow
              icon="pricetags-outline"
              label={t('finance.overview.categories')}
              onPress={() => router.push('/finance-categories')}
              testID="finance-link-categories"
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <Card onPress={onPress} testID={testID} accessibilityLabel={label}>
      <View style={styles.linkRow}>
        <Ionicons name={icon} size={IconSize.md} color={colors.primary} />
        <AppText variant="bodyStrong" style={styles.linkLabel}>
          {label}
        </AppText>
        <Ionicons name="chevron-forward" size={IconSize.sm} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  list: {
    gap: Spacing.sm,
  },
  links: {
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  linkLabel: {
    flex: 1,
  },
});
