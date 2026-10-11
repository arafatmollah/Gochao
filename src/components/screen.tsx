import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Colors } from '@/theme/tokens';

export interface ScreenProps {
  children: ReactNode;
  /** Safe-area edges to apply; defaults to top + bottom for full screens. */
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, edges = ['top', 'bottom'], style }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
