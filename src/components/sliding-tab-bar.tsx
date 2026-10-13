import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { AnimatedTabIcon } from './animated-tab-icon';
import { AppText } from './app-text';
import { useTranslation } from '@/i18n';
import { Radius, Spacing, type ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

interface TabConfig {
  labelKey: string;
  icon: Parameters<typeof AnimatedTabIcon>[0]['icon'];
  focusedIcon: Parameters<typeof AnimatedTabIcon>[0]['focusedIcon'];
}

const TAB_CONFIG: Record<string, TabConfig> = {
  index: { labelKey: 'nav.home', icon: 'home-outline', focusedIcon: 'home' },
  tasks: { labelKey: 'nav.tasks', icon: 'checkbox-outline', focusedIcon: 'checkbox' },
  bills: { labelKey: 'nav.bills', icon: 'receipt-outline', focusedIcon: 'receipt' },
  finance: { labelKey: 'nav.finance', icon: 'wallet-outline', focusedIcon: 'wallet' },
  more: { labelKey: 'nav.more', icon: 'grid-outline', focusedIcon: 'grid' },
};

const PILL_SPRING = { damping: 24, stiffness: 280 } as const;

type PillPositions = Record<number, { x: number; width: number }>;

/**
 * Plain helper (not a hook callback, so shared-value writes are allowed):
 * snaps the pill on first layout, springs on later tab switches.
 */
function movePillTo(
  index: number,
  positions: SharedValue<PillPositions>,
  translateX: SharedValue<number>,
  pillWidth: SharedValue<number>,
  pillOpacity: SharedValue<number>,
  settledRef: MutableRefObject<boolean>,
) {
  const pos = positions.value[index];
  if (!pos) {
    return;
  }
  if (!settledRef.current) {
    translateX.value = pos.x;
    pillWidth.value = pos.width;
    pillOpacity.value = 1;
    settledRef.current = true;
    return;
  }
  translateX.value = withSpring(pos.x, PILL_SPRING);
  pillWidth.value = withSpring(pos.width, PILL_SPRING);
}

/**
 * Bottom tab bar with a pill that glides between tabs. Each tab reports its
 * position on layout; when the active index changes the pill springs to the
 * new tab. First layout snaps (no fly-in from zero).
 */
export function SlidingTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const translateX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillOpacity = useSharedValue(0);
  const positions = useSharedValue<PillPositions>({});
  const activeRef = useRef(state.index);
  const settledRef = useRef(false);

  useEffect(() => {
    activeRef.current = state.index;
    movePillTo(state.index, positions, translateX, pillWidth, pillOpacity, settledRef);
  }, [state.index, positions, translateX, pillWidth, pillOpacity]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    width: pillWidth.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
      <View style={styles.row}>
        <Animated.View style={[styles.pill, pillStyle]} />
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const config = TAB_CONFIG[route.name] ?? TAB_CONFIG.more;
          const color = focused ? colors.primary : colors.textMuted;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                positions.value = { ...positions.value, [index]: { x, width } };
                if (index === activeRef.current) {
                  movePillTo(index, positions, translateX, pillWidth, pillOpacity, settledRef);
                }
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t(config.labelKey)}
              testID={`tab-${route.name}`}
              style={styles.item}>
              <AnimatedTabIcon
                focused={focused}
                icon={config.icon}
                focusedIcon={config.focusedIcon}
                color={color}
              />
              <AppText
                variant="caption"
                style={[styles.label, focused && styles.labelFocused]}
                numberOfLines={1}>
                {t(config.labelKey)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bar: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      gap: Spacing.xs,
    },
    pill: {
      position: 'absolute',
      // onLayout x already includes the row's horizontal padding, so the pill
      // anchors at zero and rides entirely on the animated translateX.
      top: Spacing.md,
      bottom: 0,
      left: 0,
      borderRadius: Radius.lg,
      backgroundColor: colors.primarySoft,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.lg,
    },
    label: {
      color: colors.textMuted,
    },
    labelFocused: {
      color: colors.primary,
      fontWeight: '700',
    },
  });
