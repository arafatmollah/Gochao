import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useDisplay } from '@/theme/display-context';

export interface AnimatedTabIconProps {
  focused: boolean;
  /** Outline glyph shown when idle. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Filled glyph shown when focused. */
  focusedIcon: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  size?: number;
}

/**
 * Bottom-tab glyph that pops with a spring when its tab gains focus and
 * settles back when it loses it, swapping outline for the filled glyph.
 */
export function AnimatedTabIcon({
  focused,
  icon,
  focusedIcon,
  color,
  size = 24,
}: AnimatedTabIconProps) {
  const progress = useSharedValue(focused ? 1 : 0);
  const { reduceMotion } = useDisplay();

  useEffect(() => {
    progress.value = reduceMotion ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, { damping: 13, stiffness: 220 });
  }, [focused, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.22 }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={focused ? focusedIcon : icon} size={size} color={color} />
    </Animated.View>
  );
}
