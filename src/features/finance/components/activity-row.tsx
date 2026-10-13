import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { categoryDisplayName, categoryIcon } from '@/features/finance/meta';
import { signedMoneyText } from '@/features/finance/format';
import { useTranslation } from '@/i18n';
import { formatIsoDateRelative } from '@/i18n/format';
import { useAppTheme } from '@/theme/theme-context';
import { IconSize, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import type { ActivityRow as ActivityRowData } from '@/types/finance';

export interface ActivityRowProps {
  row: ActivityRowData;
  /** Today's ISO date, for the Today/Yesterday relative label. */
  today: string;
  onPress?: () => void;
  testID?: string;
}

/**
 * One row of the unified activity feed. Transfers render their own kind so
 * they are never presented as income or expenses.
 */
export function ActivityRowItem({ row, today, onPress, testID }: ActivityRowProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const icon =
    row.kind === 'transfer'
      ? 'swap-horizontal-outline'
      : categoryIcon({
          id: row.categoryId ?? '',
          kind: row.kind,
          isBuiltin: row.categoryIsBuiltin,
        });

  const title =
    row.kind === 'transfer'
      ? t('finance.transactions.transferBetween', {
          from: row.accountName,
          to: row.toAccountName ?? '',
        })
      : (row.description ?? '');

  const categoryName =
    row.kind !== 'transfer' && row.categoryId
      ? categoryDisplayName(
          { id: row.categoryId, name: row.categoryName ?? '', isBuiltin: row.categoryIsBuiltin },
          t,
        )
      : null;
  const subtitle =
    row.kind === 'transfer' ? (row.notes ?? '') : [categoryName, row.accountName].join(' · ');

  const amountColor =
    row.kind === 'income'
      ? colors.success
      : row.kind === 'expense'
        ? colors.danger
        : colors.textSecondary;

  return (
    <Card onPress={onPress} testID={testID} accessibilityLabel={onPress ? title : undefined}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={IconSize.md} color={colors.primary} />
        </View>
        <View style={styles.body}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle.length > 0 ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
          {row.billOccurrenceId ? (
            <Badge
              label={t('finance.transactions.billLinked')}
              color={colors.textSecondary}
              backgroundColor={colors.surfaceMuted}
            />
          ) : null}
        </View>
        <View style={styles.amountColumn}>
          <AppText variant="bodyStrong" style={{ color: amountColor }} numberOfLines={1}>
            {signedMoneyText(row.amountMinor, row.kind, locale)}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {formatIsoDateRelative(row.occurredOn, today, t)}
          </AppText>
        </View>
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
    amountColumn: {
      alignItems: 'flex-end',
      gap: 2,
    },
  });
