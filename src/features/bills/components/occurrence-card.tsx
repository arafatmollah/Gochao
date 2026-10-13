import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { formatIsoDateRelative, formatMoney } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { BILL_CATEGORY_ICONS } from '@/features/bills/meta';
import { useAppTheme } from '@/theme/theme-context';
import { CardShadow, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import type { BillCategory, BillOccurrence } from '@/types/bill';

export interface OccurrenceCardProps {
  occurrence: BillOccurrence;
  category: BillCategory;
  /** Bill name for list contexts; omit on the bill detail screen. */
  billName?: string;
  today: string;
  /** `due` renders pending text, `history` renders the recorded payment. */
  variant: 'due' | 'history';
  onPress?: () => void;
  /** Optional trailing action (record payment / mark unpaid). */
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  testID?: string;
}

/**
 * One occurrence (an individual due) as a card: category icon, bill name,
 * date + amount, and an optional action. Payment state is shown through the
 * variant — a recorded payment is a local record only (never a claim that
 * the biller was paid).
 */
export function OccurrenceCard({
  occurrence,
  category,
  billName,
  today,
  variant,
  onPress,
  actionLabel,
  onAction,
  actionLoading = false,
  testID,
}: OccurrenceCardProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDue = variant === 'due';

  const dateText = isDue
    ? formatIsoDateRelative(occurrence.dueOn, today, t)
    : t('bills.history.paidOn', {
        date: formatIsoDateRelative(occurrence.paidOn ?? occurrence.dueOn, today, t),
      });
  const dateColor = isDue ? dueDateTone(occurrence.dueOn, today, colors) : colors.textSecondary;

  const amountText = isDue
    ? t('bills.due.expected', { amount: formatMoney(occurrence.expectedAmountMinor, locale) })
    : t('bills.detail.paidAmount', {
        amount: formatMoney(occurrence.paidAmountMinor ?? occurrence.expectedAmountMinor, locale),
      });

  const body = (
    <>
      <View style={styles.iconCircle}>
        <Ionicons name={BILL_CATEGORY_ICONS[category]} size={IconSize.md} color={colors.primary} />
      </View>
      <View style={styles.body}>
        {billName ? (
          <AppText variant="bodyStrong" numberOfLines={2}>
            {billName}
          </AppText>
        ) : null}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name={isDue ? 'calendar-outline' : 'checkmark-circle-outline'}
              size={IconSize.sm - 2}
              color={dateColor}
            />
            <AppText variant="caption" style={{ color: dateColor }}>
              {dateText}
            </AppText>
          </View>
          <AppText variant="caption" color="textSecondary">
            {amountText}
          </AppText>
        </View>
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
      ) : null}
    </>
  );

  return (
    <View style={styles.card} testID={testID}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={billName ? `${billName}, ${dateText}` : dateText}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          {body}
        </Pressable>
      ) : (
        <View style={styles.row}>{body}</View>
      )}

      {actionLabel && onAction ? (
        <View style={styles.actionRow}>
          <Button
            label={actionLabel}
            variant={isDue ? 'primary' : 'secondary'}
            size="sm"
            onPress={onAction}
            loading={actionLoading}
            fullWidth
          />
        </View>
      ) : null}
    </View>
  );
}

function dueDateTone(dueOn: string, today: string, colors: ThemeColors): string {
  if (dueOn < today) {
    return colors.danger;
  }
  if (dueOn === today) {
    return colors.warning;
  }
  return colors.textSecondary;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
      ...CardShadow,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    pressed: {
      opacity: 0.7,
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
      gap: Spacing.xs,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    actionRow: {
      paddingLeft: 40 + Spacing.md,
    },
  });
