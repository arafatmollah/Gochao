import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { categoryDisplayName, categoryIcon } from '@/features/finance/meta';
import { useTranslation } from '@/i18n';
import { formatMoney } from '@/i18n/format';
import { useAppTheme } from '@/theme/theme-context';
import { IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import type { BudgetWithUsage } from '@/types/finance';

export interface BudgetRowProps {
  budget: BudgetWithUsage;
  onPress?: () => void;
  testID?: string;
}

/** One monthly budget: category, spent-of-limit progress and remaining/over capture. */
export function BudgetRow({ budget, onPress, testID }: BudgetRowProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const displayName = categoryDisplayName(
    {
      id: budget.categoryId,
      name: budget.categoryName,
      isBuiltin: budget.categoryIsBuiltin,
    },
    t,
  );
  const icon = categoryIcon({
    id: budget.categoryId,
    kind: 'expense',
    isBuiltin: budget.categoryIsBuiltin,
  });

  const ratio = budget.amountMinor > 0 ? budget.spentMinor / budget.amountMinor : 0;
  const barColor = ratio > 1 ? colors.danger : ratio >= 0.8 ? colors.warning : colors.primary;
  const exceeded = budget.spentMinor > budget.amountMinor;
  const remainingMinor = budget.amountMinor - budget.spentMinor;
  const percent = Math.round(ratio * 100);

  return (
    <Card onPress={onPress} testID={testID} accessibilityLabel={displayName}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={IconSize.md} color={colors.primary} />
        </View>
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {displayName}
            </AppText>
            {exceeded ? (
              <Badge
                label={t('finance.budgets.exceededBadge')}
                color={colors.danger}
                backgroundColor={colors.dangerSoft}
              />
            ) : null}
          </View>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {t('finance.budgets.spentOf', {
              spent: formatMoney(budget.spentMinor, locale),
              amount: formatMoney(budget.amountMinor, locale),
            })}
          </AppText>
        </View>
      </View>

      <View style={styles.track}>
        <View
          testID={testID ? `${testID}-bar` : undefined}
          style={[
            styles.fill,
            { backgroundColor: barColor, width: `${Math.min(100, Math.round(ratio * 100))}%` },
          ]}
        />
      </View>

      <View style={styles.footRow}>
        <AppText variant="caption" color={exceeded ? 'danger' : 'textSecondary'}>
          {exceeded
            ? t('finance.budgets.overBy', {
                amount: formatMoney(Math.abs(remainingMinor), locale),
              })
            : t('finance.budgets.remaining', {
                amount: formatMoney(Math.max(0, remainingMinor), locale),
              })}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {t('finance.budgets.percentUsed', { percent })}
        </AppText>
      </View>
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      gap: 2,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    name: {
      flexShrink: 1,
    },
    track: {
      height: 8,
      borderRadius: Radius.pill,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
      marginTop: Spacing.md,
    },
    fill: {
      height: '100%',
      borderRadius: Radius.pill,
    },
    footRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Spacing.xs,
    },
  });
