import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CardShadow, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Card({ children, onPress, style, accessibilityLabel, testID }: CardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      ...CardShadow,
    },
    pressed: {
      backgroundColor: colors.surfaceMuted,
    },
  });
