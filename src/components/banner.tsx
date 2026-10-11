import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Colors, IconSize, Radius, Spacing } from '@/theme/tokens';

import { AppText } from './app-text';

export interface BannerProps {
  message: string;
  tone?: 'danger' | 'info';
  onDismiss?: () => void;
  testID?: string;
}

/** Inline notice for failed actions and other non-blocking problems. */
export function Banner({ message, tone = 'danger', onDismiss, testID }: BannerProps) {
  const { t } = useTranslation();
  const isDanger = tone === 'danger';
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[styles.container, { backgroundColor: isDanger ? Colors.dangerSoft : Colors.primarySoft }]}>
      <Ionicons
        name={isDanger ? 'alert-circle-outline' : 'information-circle-outline'}
        size={IconSize.md}
        color={isDanger ? Colors.danger : Colors.primary}
      />
      <AppText variant="caption" style={[styles.message, { color: isDanger ? Colors.danger : Colors.primary }]}>
        {message}
      </AppText>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss')}>
          <Ionicons name="close" size={IconSize.md} color={isDanger ? Colors.danger : Colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  message: {
    flex: 1,
  },
});
