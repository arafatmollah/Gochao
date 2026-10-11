import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Colors, IconSize, Spacing } from '@/theme/tokens';

import { AppText } from './app-text';
import { Button } from './button';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export function EmptyState({
  icon = 'checkbox-outline',
  title,
  message,
  actionLabel,
  onAction,
  testID,
}: EmptyStateProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={IconSize.xl} color={Colors.textMuted} />
      </View>
      <AppText variant="subheading" align="center">
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center" style={styles.message}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="primary" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    marginBottom: Spacing.md,
    maxWidth: 320,
  },
});
