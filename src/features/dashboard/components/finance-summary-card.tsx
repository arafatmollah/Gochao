import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { useTranslation } from '@/i18n';
import { formatMoney } from '@/i18n/format';
import { Colors, IconSize, Spacing, Typography } from '@/theme/tokens';

import type { DashboardFinance } from '../finance-summary';

export interface FinanceSummaryCardProps {
  finance: DashboardFinance;
  onPress: () => void;
  testID?: string;
}

/**
 * Light money card for the dashboard, laid out like the finance screen's
 * balance card (big total balance, divider-separated month columns) on a
 * white surface. Every figure is read from the database through
 * `useDashboard` — never hardcoded (rule 6).
 */
export function FinanceSummaryCard({ finance, onPress, testID }: FinanceSummaryCardProps) {
  const { t, locale } = useTranslation();

  return (
    <Card
      onPress={onPress}
      testID={testID}
      accessibilityLabel={t('dashboard.financeTitle')}
      style={styles.card}>
      <View style={styles.headerRow}>
        <AppText variant="label" color="textSecondary">
          {t('dashboard.financeTitle')}
        </AppText>
        <View style={styles.linkRow}>
          <AppText variant="caption" color="primary">
            {t('dashboard.financeSeeAll')}
          </AppText>
          <Ionicons name="chevron-forward" size={IconSize.sm} color={Colors.primary} />
        </View>
      </View>

      <View style={styles.balanceBlock}>
        <AppText variant="caption" color="textMuted">
          {t('finance.overview.balanceTotal')}
        </AppText>
        <AppText variant="heroValue" numberOfLines={1} style={styles.value}>
          {formatMoney(finance.totalBalanceMinor, locale)}
        </AppText>
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <AppText variant="caption" color="textSecondary" numberOfLines={2} style={styles.columnLabel}>
            {t('finance.overview.incomeThisMonth')}
          </AppText>
          <AppText variant="bodyStrong" color="success" numberOfLines={1}>
            {formatMoney(finance.monthIncomeMinor, locale)}
          </AppText>
        </View>
        <View style={styles.columnDivider} />
        <View style={styles.column}>
          <AppText variant="caption" color="textSecondary" numberOfLines={2} style={styles.columnLabel}>
            {t('finance.overview.expenseThisMonth')}
          </AppText>
          <AppText variant="bodyStrong" color="danger" numberOfLines={1}>
            {formatMoney(finance.monthExpenseMinor, locale)}
          </AppText>
        </View>
        <View style={styles.columnDivider} />
        <View style={styles.column}>
          <AppText variant="caption" color="textSecondary" numberOfLines={2} style={styles.columnLabel}>
            {t('finance.overview.savingsThisMonth')}
          </AppText>
          <AppText
            variant="bodyStrong"
            color={finance.monthNetMinor < 0 ? 'danger' : 'success'}
            numberOfLines={1}>
            {formatMoney(finance.monthNetMinor, locale)}
          </AppText>
        </View>
      </View>

      <AppText variant="caption" color="textMuted" numberOfLines={1}>
        {`${t('dashboard.financeTodayExpense')} ${formatMoney(finance.todayExpenseMinor, locale)}`}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  balanceBlock: {
    gap: 2,
  },
  value: {
    marginBottom: Spacing.sm,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  column: {
    flex: 1,
    gap: 2,
  },
  columnDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  columnLabel: {
    // Reserve two caption lines so all three value rows align even when one
    // label wraps ("Expenses this month" / "Net savings this month").
    minHeight: Typography.caption.lineHeight * 2,
  },
});
