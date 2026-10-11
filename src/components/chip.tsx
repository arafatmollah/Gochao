import { Pressable, StyleSheet } from 'react-native';

import { Colors, Radius, Spacing } from '@/theme/tokens';

import { AppText } from './app-text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}

/** Compact selectable pill used for status/priority filters and quick picks. */
export function Chip({ label, selected = false, onPress, testID }: ChipProps) {
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

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.md,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipPressed: {
    opacity: 0.7,
  },
});
