import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { formatIsoDateDisplay } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { Colors, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { PrayerDay, PrayerStatus } from '@/types/prayer';

export interface PrayerHistoryDayProps {
  day: PrayerDay;
  testID?: string;
}

export function PrayerHistoryDay({ day, testID }: PrayerHistoryDayProps) {
  const { t } = useTranslation();
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
  return (
    <View
      style={[
        styles.dot,
        status === 'prayed' && styles.dotPrayed,
        status === 'missed' && styles.dotMissed,
      ]}>
      {status === 'prayed' ? (
        <Ionicons name="checkmark" size={IconSize.sm} color={Colors.surface} />
      ) : status === 'missed' ? (
        <Ionicons name="close" size={IconSize.sm} color={Colors.surface} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPrayed: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dotMissed: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
});
