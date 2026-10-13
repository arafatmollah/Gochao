import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { formatIsoDateDisplay } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { PrayerDay, PrayerStatus } from '@/types/prayer';

export interface PrayerHistoryDayProps {
  day: PrayerDay;
  testID?: string;
}

export function PrayerHistoryDay({ day, testID }: PrayerHistoryDayProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const prayed = day.prayers.filter((entry) => entry.status === 'prayed').length;

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <AppText variant="bodyStrong">{formatIsoDateDisplay(day.date, t)}</AppText>
        <AppText variant="caption" color="textSecondary">
          {t('prayer.daySummary', { prayed, total: day.prayers.length })}
        </AppText>
      </View>
      <View style={styles.dots}>
        {day.prayers.map((entry) => (
          <View key={entry.prayer} style={styles.dotCell}>
            <StatusDot status={entry.status} />
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {t(`prayer.names.${entry.prayer}`)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatusDot({ status }: { status: PrayerStatus | null }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View
      style={[
        styles.dot,
        status === 'prayed' && styles.dotPrayed,
        status === 'missed' && styles.dotMissed,
      ]}>
      {status === 'prayed' ? (
        <Ionicons name="checkmark" size={IconSize.sm} color={colors.surface} />
      ) : status === 'missed' ? (
        <Ionicons name="close" size={IconSize.sm} color={colors.surface} />
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    header: {
      gap: 2,
    },
    dots: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    dotCell: {
      flex: 1,
      alignItems: 'center',
      gap: Spacing.xs,
    },
    dot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotPrayed: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dotMissed: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
  });
