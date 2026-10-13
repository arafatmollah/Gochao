import { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

import { AppText } from './app-text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}

/** Compact selectable pill used for status/priority filters and quick picks. */
export function Chip({ label, selected = false, onPress, testID }: ChipProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={selected}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}>
      <AppText variant="label" color={selected ? 'onPrimary' : 'textSecondary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: Spacing.md,
      height: 36,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipPressed: {
      opacity: 0.7,
    },
  });
