import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

import { AppText } from './app-text';

export interface LoadingStateProps {
  label?: string;
  testID?: string;
}

export function LoadingState({ label, testID }: LoadingStateProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.container} testID={testID} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.primary} />
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
