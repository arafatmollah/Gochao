import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useTranslation } from '@/i18n';
import { formatWallClock12 } from '@/i18n/format';
import {
  findCurrentPrayer,
  findNextPrayer,
  nowWallClock,
  wallClockToMinutes,
} from '@/services/prayer-calculation';
import { IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import { useDisplay } from '@/theme/display-context';
import { isDayPrayer, type PrayerDay, type PrayerName } from '@/types/prayer';

import { LiveTimer } from './live-timer';

export interface PrayerWidgetProps {
  /** Today's schedule with statuses; null hides the widget. */
  day: PrayerDay | null;
  onPress: () => void;
  testID?: string;
}

/**
 * Animated prayer widget for the home dashboard: the active prayer window
 * with a live countdown, an animated progress bar,
 * and per-prayer status dots. Read-only — tapping anywhere opens the
 * prayer module for logging.
 */
export function PrayerWidget({ day, onPress, testID }: PrayerWidgetProps) {
  const { colors } = useAppTheme();
  const { reduceMotion } = useDisplay();
  const { t, locale } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [clockTick, setClockTick] = useState(() => nowWallClock());
  const progressAnim = useSharedValue(0);

  // Ticks the countdown and progress while the dashboard stays open.
  useEffect(() => {
    const timer = setInterval(() => setClockTick(nowWallClock()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const next = useMemo(() => {
    if (!day) {
      return null;
    }
    return findNextPrayer(
      day.prayers.map(({ prayer, time }) => ({ prayer, time })),
      clockTick,
    );
  }, [day, clockTick]);

  const current = useMemo(() => {
    if (!day) {
      return null;
    }
    return findCurrentPrayer(
      day.prayers.map(({ prayer, time }) => ({ prayer, time })),
      clockTick,
    );
  }, [day, clockTick]);

  const progress = useMemo(() => {
    if (!day) {
      return 0;
    }
    // Elapsed share of the active window (start -> next prayer start),
    // located by name in the day's own order (tahajjud first). Isha's
    // open-ended window reads as a complete day (1).
    if (current === null) {
      return 0;
    }
    const position = day.prayers.findIndex((entry) => entry.prayer === current);
    const currentEntry = position >= 0 ? day.prayers[position] : undefined;
    const endEntry = position >= 0 ? day.prayers[position + 1] : undefined;
    if (!currentEntry || !endEntry) {
      return 1;
    }
    const startMinutes = wallClockToMinutes(currentEntry.time) ?? 0;
    const endMinutes = wallClockToMinutes(endEntry.time) ?? 0;
    const nowMinutes = wallClockToMinutes(clockTick) ?? 0;
    const span = endMinutes - startMinutes;
    if (span <= 0) {
      return 0;
    }
    return Math.min(Math.max((nowMinutes - startMinutes) / span, 0), 1);
  }, [day, current, clockTick]);

  useEffect(() => {
    progressAnim.value = withTiming(progress, { duration: 900 });
  }, [progress, progressAnim]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  if (!day) {
    return null;
  }

  const prayedCount = day.prayers.filter((entry) => entry.status === 'prayed').length;
  // Focus entry: the active window's prayer; before Fajr (no active
  // prayer yet) the upcoming one. Its countdown runs to the window end,
  // or to its start when nothing is active yet.
  const activeEntry = current ? day.prayers.find((entry) => entry.prayer === current) : undefined;
  const nextEntry = next ? day.prayers.find((entry) => entry.prayer === next) : undefined;
  const focusEntry = activeEntry ?? nextEntry;
  const activePosition = activeEntry
    ? day.prayers.findIndex((entry) => entry.prayer === activeEntry.prayer)
    : -1;
  const windowEnd =
    activePosition >= 0 ? (day.prayers[activePosition + 1]?.time ?? null) : null;
  const timerTarget = windowEnd ?? (!activeEntry ? nextEntry?.time : undefined);
  const activePrayer = current ?? next;
  const badgeIcon =
    focusEntry && isDayPrayer(focusEntry.prayer) ? 'sunny-outline' : 'moon-outline';

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(450).delay(80)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('prayer.title')}
        testID={testID}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <View style={styles.topRow}>
          <View style={styles.iconBadge}>
            <Ionicons
              name={badgeIcon}
              size={IconSize.md}
              color={colors.heroText}
            />
          </View>
          <View style={styles.topText}>
            <AppText variant="label" style={styles.kicker}>
              {activeEntry ? t('dashboard.prayerNowKicker') : t('dashboard.prayerNextKicker')}
            </AppText>
            <AppText variant="caption" style={styles.muted}>
              {t('prayer.daySummary', { prayed: prayedCount, total: day.prayers.length })}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={colors.heroMuted} />
        </View>

        {focusEntry ? (
          <View style={styles.nextRow}>
            <AppText variant="heroValue" style={styles.nextName}>
              {t(`prayer.names.${focusEntry.prayer}`)}
            </AppText>
            <View style={styles.nextTime}>
              <AppText variant="heading" style={styles.timeText}>
                {windowEnd
                  ? t('prayer.timeWindow', {
                      start: formatWallClock12(focusEntry.time, locale),
                      end: formatWallClock12(windowEnd, locale),
                    })
                  : formatWallClock12(focusEntry.time, locale)}
              </AppText>
              {timerTarget ? (
                <LiveTimer targetTime={timerTarget} testID="dashboard-prayer-timer" />
              ) : null}
            </View>
          </View>
        ) : (
          <AppText variant="bodyStrong" style={styles.nextName}>
            {t('prayer.allDone')}
          </AppText>
        )}

        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>

        <View style={styles.dots}>
          {day.prayers.map((entry) => (
            <PrayerDot
              key={entry.prayer}
              prayer={entry.prayer}
              time={formatWallClock12(entry.time, locale)}
              status={entry.status}
              isActive={entry.prayer === activePrayer}
            />
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function PrayerDot({
  prayer,
  time,
  status,
  isActive,
}: {
  prayer: PrayerName;
  time: string;
  status: 'prayed' | 'missed' | null;
  isActive: boolean;
}) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const day = isDayPrayer(prayer);
  return (
    <View style={styles.dotCell}>
      <View
        style={[
          styles.dot,
          status === 'prayed' && styles.dotPrayed,
          status === 'missed' && styles.dotMissed,
          isActive && styles.dotNext,
        ]}>
        {status === 'prayed' ? (
          <Ionicons name="checkmark" size={IconSize.sm} color={colors.heroText} />
        ) : status === 'missed' ? (
          <Ionicons name="close" size={IconSize.sm} color={colors.heroText} />
        ) : (
          <Ionicons
            name={day ? 'sunny-outline' : 'moon-outline'}
            size={IconSize.sm}
            color={day ? colors.accentGoldSoft : colors.heroMuted}
          />
        )}
      </View>
      <AppText variant="caption" style={[styles.muted, isActive && styles.nextLabel]} numberOfLines={1}>
        {t(`prayer.names.${prayer}`)}
      </AppText>
      <AppText variant="caption" style={[styles.dotTime, isActive && styles.nextLabel]} numberOfLines={1}>
        {time}
      </AppText>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.primaryPressed,
      borderRadius: Radius.xl,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    cardPressed: {
      opacity: 0.92,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    iconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.heroTrack,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topText: {
      flex: 1,
      gap: 2,
    },
    kicker: {
      color: colors.heroText,
    },
    muted: {
      color: colors.heroMuted,
    },
    nextRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    nextName: {
      color: colors.heroText,
      flex: 1,
    },
    nextTime: {
      alignItems: 'flex-end',
      gap: 2,
    },
    timeText: {
      color: colors.heroText,
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.heroTrack,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: colors.accentGoldSoft,
    },
    dots: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    dotCell: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    dot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.heroTrack,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotPrayed: {
      backgroundColor: colors.success,
    },
    dotMissed: {
      backgroundColor: colors.danger,
    },
    dotNext: {
      borderWidth: 2,
      borderColor: colors.heroText,
    },
    dotTime: {
      color: colors.heroMuted,
    },
    nextLabel: {
      color: colors.heroText,
      fontWeight: '600',
    },
  });
