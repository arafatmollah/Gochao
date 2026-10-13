import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { BILL_CATEGORY_ICONS } from '@/features/bills/meta';
import { formatNumber, useTranslation } from '@/i18n';
import { formatIsoDateRelative } from '@/i18n/format';
import { useAppTheme } from '@/theme/theme-context';
import { CardShadow, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import type { BillSummary } from '@/types/bill';

export interface BillRowProps {
  summary: BillSummary;
  today: string;
  onPress: () => void;
  testID?: string;
}

/** A bill definition row: category, name, schedule facts, and next due. */
export function BillRow({ summary, today, onPress, testID }: BillRowProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const installmentProgress =
    summary.installmentCount !== null
      ? t('bills.list.installmentProgress', {
          paid: formatNumber(summary.paidCount, locale),
          total: formatNumber(summary.installmentCount, locale),
        })
      : null;

  const upcoming =
    summary.nextDueOn !== null
      ? t('bills.list.nextDue', { date: formatIsoDateRelative(summary.nextDueOn, today, t) })
      : summary.paidCount > 0
        ? t('bills.list.completed')
        : t('bills.list.noUpcoming');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${summary.name}, ${upcoming}`}
      testID={testID}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconCircle}>
        <Ionicons
          name={BILL_CATEGORY_ICONS[summary.category]}
          size={IconSize.md}
          color={summary.isArchived ? colors.textMuted : colors.primary}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {summary.name}
          </AppText>
          {summary.isArchived ? (
            <Badge
              label={t('bills.list.archived')}
              color={colors.textMuted}
              backgroundColor={colors.surfaceMuted}
            />
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <AppText variant="caption" color="textSecondary">
            {t(`bills.categories.${summary.category}`)}
          </AppText>
          <AppText variant="caption" color="textMuted">
            ·
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {t(`bills.recurrences.${summary.recurrence}`)}
          </AppText>
          {installmentProgress ? (
            <>
              <AppText variant="caption" color="textMuted">
                ·
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {installmentProgress}
              </AppText>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>
        <AppText
          variant="caption"
          color={summary.nextDueOn !== null ? 'textSecondary' : 'textMuted'}
          numberOfLines={2}
          align="right">
          {upcoming}
        </AppText>
        <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      ...CardShadow,
    },
    pressed: {
      backgroundColor: colors.surfaceMuted,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      gap: Spacing.xs,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    name: {
      flexShrink: 1,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    right: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      maxWidth: 130,
    },
  });
