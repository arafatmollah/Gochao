import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useNow } from '@/hooks/use-now';
import { useTranslation } from '@/i18n';
import { formatCountdownHMS } from '@/i18n/format';
import { wallClockToMinutes } from '@/services/prayer-calculation';
import { useDisplay } from '@/theme/display-context';
import { Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

export interface LiveTimerProps {
  /** Target wall-clock `HH:mm` (24-hour) later today. */
  targetTime: string;
  /** Text color variant for light-on-dark vs dark-on-light surfaces. */
  tone?: 'light' | 'dark';
  testID?: string;
}

/**
 * Stopwatch-style live countdown to a wall-clock time, ticking every
 * second (`02:14:33`) with a pulsing live dot. Renders nothing when the
 * target is invalid or already passed.
 */
export function LiveTimer({ targetTime, tone = 'light', testID }: LiveTimerProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const now = useNow(1000);
  const pulse = useSharedValue(1);
  const { reduceMotion } = useDisplay();

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(withTiming(0.35, { duration: 900 }), -1, true);
  }, [pulse, reduceMotion]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const targetMinutes = wallClockToMinutes(targetTime);
  if (targetMinutes === null) {
    return null;
  }
  const target = new Date(now);
  target.setHours(Math.floor(targetMinutes / 60), targetMinutes % 60, 0, 0);
  const secondsLeft = Math.round((target.getTime() - now.getTime()) / 1000);
  if (secondsLeft < 0) {
    return null;
  }

  const color = tone === 'light' ? colors.heroText : colors.text;
  const muted = tone === 'light' ? colors.heroMuted : colors.textSecondary;

  return (
    <View style={styles.row} testID={testID}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
      <AppText variant="bodyStrong" style={{ color }} numberOfLines={1}>
        {formatCountdownHMS(secondsLeft, locale)}
      </AppText>
      <AppText variant="caption" style={{ color: muted }}>
        {t('prayer.timeLeft')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
