import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Colors, Spacing } from '@/theme/tokens';

import { AppText } from './app-text';

export interface LoadingStateProps {
  label?: string;
  testID?: string;
}

export function LoadingState({ label, testID }: LoadingStateProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container} testID={testID} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={Colors.primary} />
      <AppText variant="body" color="textSecondary">
        {label ?? t('common.loading')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
});
