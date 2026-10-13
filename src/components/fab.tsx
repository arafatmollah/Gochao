import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { CardShadow, IconSize, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

export interface FabProps {
  onPress: () => void;
  /** Required: the FAB is icon-only, so the label is how it is announced. */
  accessibilityLabel: string;
  testID?: string;
}

/** Floating action button — rounded-square, primary color, subtle shadow. */
export function Fab({ onPress, accessibilityLabel, testID }: FabProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
      <Ionicons name="add" size={IconSize.xl - 4} color={colors.onPrimary} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    fab: {
      position: 'absolute',
      right: Spacing.lg,
      bottom: Spacing.xl,
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...CardShadow,
    },
    pressed: {
      backgroundColor: colors.primaryPressed,
    },
  });
