import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

export interface ScreenProps {
  children: ReactNode;
  /** Safe-area edges to apply; defaults to top + bottom for full screens. */
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, edges = ['top', 'bottom'], style }: ScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });
