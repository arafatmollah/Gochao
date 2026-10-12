import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTranslation } from '@/i18n';
import { formatWallClock12 } from '@/i18n/format';
import { CardShadow, Colors, IconSize, Radius, Spacing } from '@/theme/tokens';
import { isDayPrayer } from '@/types/prayer';
import type { DayPrayer, PrayerStatus } from '@/types/prayer';

export interface PrayerTimeRowProps {
  entry: DayPrayer;
  highlighted: boolean;
  onCycleStatus: () => void;
  testID?: string;
}

/** Midnight gradient for night prayers (Fajr, Maghrib, Isha). */
const NIGHT_GRADIENT = ['#232046', '#4B3670'] as const;

export function PrayerTimeRow({ entry, highlighted, onCycleStatus, testID }: PrayerTimeRowProps) {
  const { t, locale } = useTranslation();
  const day = isDayPrayer(entry.prayer);
  const time12 = formatWallClock12(entry.time, locale);

  const iconName = day ? 'sunny-outline' : 'moon-outline';
  const status = entry.status;

  const mainColor = day ? Colors.text : Colors.heroText;
  const mutedColor = day ? Colors.textSecondary : Colors.heroMuted;
  const checkColor =
    status === 'prayed'
      ? day
        ? Colors.primary
        : Colors.heroPositive
      : status === 'missed'
        ? day
          ? Colors.danger
          : Colors.heroNegative
        : day
          ? Colors.borderStrong
          : Colors.heroMuted;

  const content = (
    <View style={styles.inner}>
      <View style={[styles.iconBadge, day ? styles.iconBadgeDay : styles.iconBadgeNight]}>
        <Ionicons
          name={iconName}
          size={IconSize.md}
          color={day ? Colors.accentGold : Colors.heroText}
        />
      </View>

      <View style={styles.body}>
        <AppText variant="bodyStrong" style={{ color: mainColor }}>
          {t(`prayer.names.${entry.prayer}`)}
        </AppText>
        <AppText variant="caption" style={{ color: mutedColor }}>
          {time12}
        </AppText>
      </View>

      {status ? <StatusBadge status={status} onDark={!day} /> : null}

      <Pressable
        onPress={onCycleStatus}
        hitSlop={8}
        accessibilityRole="checkbox"
        aria-checked={status === 'prayed'}
        accessibilityLabel={
          status === 'prayed'
            ? t('prayer.status.clearStatus', { name: t(`prayer.names.${entry.prayer}`) })
            : t('prayer.status.markPrayed', { name: t(`prayer.names.${entry.prayer}`) })
        }
        testID={testID}
        style={styles.checkbox}>
        <Ionicons
          name={
            status === 'prayed'
              ? 'checkmark-circle'
              : status === 'missed'
                ? 'close-circle'
                : 'ellipse-outline'
          }
          size={IconSize.lg}
          color={checkColor}
        />
      </Pressable>
    </View>
  );

  if (!day) {
    return (
      <LinearGradient
        colors={[...NIGHT_GRADIENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.shell, highlighted && styles.shellNightHighlighted]}>
        {content}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.shell, styles.shellDay, highlighted && styles.shellDayHighlighted]}>
      {content}
    </View>
  );
}

function StatusBadge({ status, onDark }: { status: PrayerStatus; onDark: boolean }) {
  const { t } = useTranslation();
  const prayed = status === 'prayed';
  const backgroundColor = onDark
    ? Colors.heroTrack
    : prayed
      ? Colors.primarySoft
      : Colors.dangerSoft;
  const textColor = onDark
    ? prayed
      ? Colors.heroPositive
      : Colors.heroNegative
    : prayed
      ? Colors.primary
      : Colors.danger;
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <AppText variant="caption" style={{ color: textColor }}>
        {t(`prayer.status.${status}`)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...CardShadow,
  },
  shellDay: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  shellDayHighlighted: {
    borderColor: Colors.primary,
  },
  shellNightHighlighted: {
    borderWidth: 1,
    borderColor: Colors.accentGoldSoft,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeDay: {
    backgroundColor: Colors.accentGoldSoft,
  },
  iconBadgeNight: {
    backgroundColor: Colors.heroTrack,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  checkbox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
