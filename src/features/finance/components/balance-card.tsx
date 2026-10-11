import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTranslation } from '@/i18n';
import { formatMoney } from '@/i18n/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';
import type { FinanceTotals } from '@/types/finance';

export interface BalanceCardProps {
  totalBalanceMinor: number;
  monthTotals: FinanceTotals;
  testID?: string;
}

/**
 * Navy summary card (reference design): total balance from records, with the
 * month's income, expenses, and net savings. Every figure is derived from the
 * database — nothing here is hardcoded (engineering rule 6).
 */
export function BalanceCard({ totalBalanceMinor, monthTotals, testID }: BalanceCardProps) {
  const { t, locale } = useTranslation();

  return (
    <View style={styles.card} testID={testID}>
      <AppText variant="label" style={styles.kicker}>
        {t('finance.overview.balanceTotal')}
      </AppText>
      <AppText variant="heroValue" style={styles.value} numberOfLines={1}>
        {formatMoney(totalBalanceMinor, locale)}
      </AppText>

      <View style={styles.columns}>
        <View style={styles.column}>
          <AppText variant="caption" style={styles.columnLabel}>
            {t('finance.overview.incomeThisMonth')}
          </AppText>
          <AppText variant="bodyStrong" style={styles.incomeValue} numberOfLines={1}>
            {formatMoney(monthTotals.incomeMinor, locale)}
          </AppText>
        </View>
        <View style={styles.columnDivider} />
        <View style={styles.column}>
          <AppText variant="caption" style={styles.columnLabel}>
            {t('finance.overview.expenseThisMonth')}
          </AppText>
          <AppText variant="bodyStrong" style={styles.expenseValue} numberOfLines={1}>
            {formatMoney(monthTotals.expenseMinor, locale)}
          </AppText>
        </View>
        <View style={styles.columnDivider} />
        <View style={styles.column}>
          <AppText variant="caption" style={styles.columnLabel}>
            {t('finance.overview.savingsThisMonth')}
          </AppText>
          <AppText
            variant="bodyStrong"
            style={monthTotals.netMinor < 0 ? styles.expenseValue : styles.incomeValue}
            numberOfLines={1}>
            {formatMoney(monthTotals.netMinor, locale)}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.hero,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.xs,
  },
  kicker: {
    color: Colors.heroMuted,
  },
  value: {
    color: Colors.heroText,
    marginBottom: Spacing.md,
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
    backgroundColor: Colors.heroTrack,
    marginHorizontal: Spacing.md,
  },
  columnLabel: {
    color: Colors.heroMuted,
  },
  incomeValue: {
    color: Colors.heroPositive,
  },
  expenseValue: {
    color: Colors.heroNegative,
  },
});
