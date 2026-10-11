import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { CardShadow, Colors, IconSize, Spacing } from '@/theme/tokens';

export interface FabProps {
  onPress: () => void;
  /** Required: the FAB is icon-only, so the label is how it is announced. */
  accessibilityLabel: string;
  testID?: string;
}

/** Floating action button — rounded-square, primary color, subtle shadow. */
export function Fab({ onPress, accessibilityLabel, testID }: FabProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
      <Ionicons name="add" size={IconSize.xl - 4} color={Colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...CardShadow,
  },
  pressed: {
    backgroundColor: Colors.primaryPressed,
  },
});
