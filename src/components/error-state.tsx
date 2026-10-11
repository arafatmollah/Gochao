import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Colors, IconSize, Spacing } from '@/theme/tokens';

import { AppText } from './app-text';
import { Button } from './button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  testID?: string;
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel,
  testID,
}: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container} testID={testID} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={IconSize.xl} color={Colors.danger} />
      <AppText variant="subheading" align="center">
        {title ?? t('errors.title')}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center" style={styles.message}>
        {message}
      </AppText>
      {onRetry ? (
        <Button label={retryLabel ?? t('errors.tryAgain')} onPress={onRetry} variant="secondary" />
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
  message: {
    marginBottom: Spacing.md,
    maxWidth: 320,
  },
});
