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
  findNextPrayer,
  nowWallClock,
  wallClockToMinutes,
} from '@/services/prayer-calculation';
import { Colors, IconSize, Radius, Spacing } from '@/theme/tokens';
import { isDayPrayer, PRAYERS, type PrayerDay, type PrayerName } from '@/types/prayer';

import { LiveTimer } from './live-timer';

export interface PrayerWidgetProps {
  /** Today's schedule with statuses; null hides the widget. */
  day: PrayerDay | null;
  onPress: () => void;
  testID?: string;
}

/**
 * Animated prayer widget for the home dashboard: the next prayer with a
 * live countdown, an animated day-progress bar, and per-prayer status dots.
 * Read-only — tapping anywhere opens the prayer module for logging.
 */
export function PrayerWidget({ day, onPress, testID }: PrayerWidgetProps) {
  const { t, locale } = useTranslation();
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

  const progress = useMemo(() => {
    if (!day) {
      return 0;
    }
    if (next === null) {
      return 1;
    }
    const nextIndex = PRAYERS.indexOf(next);
    const nextEntry = day.prayers[nextIndex];
    // Previous interval start: the previous prayer's time, or midnight
    // before Fajr.
    const prevMinutes =
      nextIndex === 0
        ? 0
        : (wallClockToMinutes(day.prayers[nextIndex - 1].time) ?? 0);
    const nextMinutes = wallClockToMinutes(nextEntry.time) ?? 0;
    const nowMinutes = wallClockToMinutes(clockTick) ?? 0;
    const span = nextMinutes - prevMinutes;
    if (span <= 0) {
      return 0;
    }
    return Math.min(Math.max((nowMinutes - prevMinutes) / span, 0), 1);
  }, [day, next, clockTick]);

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
  const nextEntry = next ? day.prayers.find((entry) => entry.prayer === next) : undefined;
  const nextIsDay = nextEntry ? isDayPrayer(nextEntry.prayer) : false;

  return (
    <Animated.View entering={FadeInUp.duration(450).delay(80)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('prayer.title')}
        testID={testID}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <View style={styles.topRow}>
          <View style={styles.iconBadge}>
            <Ionicons
              name={nextIsDay ? 'sunny-outline' : 'moon-outline'}
              size={IconSize.md}
              color={Colors.heroText}
            />
          </View>
          <View style={styles.topText}>
            <AppText variant="label" style={styles.kicker}>
              {t('dashboard.prayerNextKicker')}
            </AppText>
            <AppText variant="caption" style={styles.muted}>
              {t('prayer.daySummary', { prayed: prayedCount, total: day.prayers.length })}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.heroMuted} />
        </View>

        {nextEntry ? (
          <View style={styles.nextRow}>
            <AppText variant="heroValue" style={styles.nextName}>
              {t(`prayer.names.${nextEntry.prayer}`)}
            </AppText>
            <View style={styles.nextTime}>
              <AppText variant="heading" style={styles.timeText}>
                {formatWallClock12(nextEntry.time, locale)}
              </AppText>
              <LiveTimer targetTime={nextEntry.time} testID="dashboard-prayer-timer" />
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
              isNext={entry.prayer === next}
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
  isNext,
}: {
  prayer: PrayerName;
  time: string;
  status: 'prayed' | 'missed' | null;
  isNext: boolean;
}) {
  const { t } = useTranslation();
  const day = isDayPrayer(prayer);
  return (
    <View style={styles.dotCell}>
      <View
        style={[
          styles.dot,
          status === 'prayed' && styles.dotPrayed,
          status === 'missed' && styles.dotMissed,
          isNext && styles.dotNext,
        ]}>
        {status === 'prayed' ? (
          <Ionicons name="checkmark" size={IconSize.sm} color={Colors.heroText} />
        ) : status === 'missed' ? (
          <Ionicons name="close" size={IconSize.sm} color={Colors.heroText} />
        ) : (
          <Ionicons
            name={day ? 'sunny-outline' : 'moon-outline'}
            size={IconSize.sm}
            color={day ? Colors.accentGoldSoft : Colors.heroMuted}
          />
        )}
      </View>
      <AppText variant="caption" style={[styles.muted, isNext && styles.nextLabel]} numberOfLines={1}>
        {t(`prayer.names.${prayer}`)}
      </AppText>
      <AppText variant="caption" style={[styles.dotTime, isNext && styles.nextLabel]} numberOfLines={1}>
        {time}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.primaryPressed,
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
    backgroundColor: Colors.heroTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topText: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    color: Colors.heroText,
  },
  muted: {
    color: Colors.heroMuted,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  nextName: {
    color: Colors.heroText,
    flex: 1,
  },
  nextTime: {
    alignItems: 'flex-end',
    gap: 2,
  },
  timeText: {
    color: Colors.heroText,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.heroTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.accentGoldSoft,
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
    backgroundColor: Colors.heroTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPrayed: {
    backgroundColor: Colors.success,
  },
  dotMissed: {
    backgroundColor: Colors.danger,
  },
  dotNext: {
    borderWidth: 2,
    borderColor: Colors.heroText,
  },
  dotTime: {
    color: Colors.heroMuted,
  },
  nextLabel: {
    color: Colors.heroText,
    fontWeight: '600',
  },
});
