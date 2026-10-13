import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTranslation } from '@/i18n';
import { formatWallClock12 } from '@/i18n/format';
import { CardShadow, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import { isDayPrayer } from '@/types/prayer';
import type { DayPrayer, PrayerStatus } from '@/types/prayer';

export interface PrayerTimeRowProps {
  entry: DayPrayer;
  highlighted: boolean;
  onCycleStatus: () => void;
  /**
   * End of this prayer's availability window (the next prayer's start,
   * wall-clock `HH:mm`). Shown as a `start – end` range; null/omitted
   * shows just the start time (e.g. the day's last prayer).
   */
  endTime?: string | null;
  testID?: string;
}

/** Midnight gradient for night prayers (Fajr, Maghrib, Isha). */
const NIGHT_GRADIENT = ['#232046', '#4B3670'] as const;

export function PrayerTimeRow({ entry, highlighted, onCycleStatus, endTime, testID }: PrayerTimeRowProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const day = isDayPrayer(entry.prayer);
  const time12 = formatWallClock12(entry.time, locale);
  const end12 = endTime ? formatWallClock12(endTime, locale) : null;

  const iconName = day ? 'sunny-outline' : 'moon-outline';
  const status = entry.status;

  const mainColor = day ? colors.text : colors.heroText;
  const mutedColor = day ? colors.textSecondary : colors.heroMuted;
  const checkColor =
    status === 'prayed'
      ? day
        ? colors.primary
        : colors.heroPositive
      : status === 'missed'
        ? day
          ? colors.danger
          : colors.heroNegative
        : day
          ? colors.borderStrong
          : colors.heroMuted;

  const content = (
    <View style={styles.inner}>
      <View style={[styles.iconBadge, day ? styles.iconBadgeDay : styles.iconBadgeNight]}>
        <Ionicons
          name={iconName}
          size={IconSize.md}
          color={day ? colors.accentGold : colors.heroText}
        />
      </View>

      <View style={styles.body}>
        <AppText variant="bodyStrong" style={{ color: mainColor }}>
          {t(`prayer.names.${entry.prayer}`)}
        </AppText>
        <AppText variant="caption" style={{ color: mutedColor }}>
          {end12 ? t('prayer.timeWindow', { start: time12, end: end12 }) : time12}
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
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const prayed = status === 'prayed';
  const backgroundColor = onDark
    ? colors.heroTrack
    : prayed
      ? colors.primarySoft
      : colors.dangerSoft;
  const textColor = onDark
    ? prayed
      ? colors.heroPositive
      : colors.heroNegative
    : prayed
      ? colors.primary
      : colors.danger;
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <AppText variant="caption" style={{ color: textColor }}>
        {t(`prayer.status.${status}`)}
      </AppText>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    shell: {
      borderRadius: Radius.lg,
      overflow: 'hidden',
      ...CardShadow,
    },
    shellDay: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    shellDayHighlighted: {
      borderColor: colors.primary,
    },
    shellNightHighlighted: {
      borderWidth: 1,
      borderColor: colors.accentGoldSoft,
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
      backgroundColor: colors.accentGoldSoft,
    },
    iconBadgeNight: {
      backgroundColor: colors.heroTrack,
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
