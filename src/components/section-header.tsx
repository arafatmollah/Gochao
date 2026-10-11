import { StyleSheet, View } from 'react-native';

import { useTranslation, formatNumber } from '@/i18n';
import { Colors, Spacing } from '@/theme/tokens';

import { AppText } from './app-text';

export interface SectionHeaderProps {
  title: string;
  count?: number;
  tone?: 'default' | 'danger';
  testID?: string;
}

export function SectionHeader({ title, count, tone = 'default', testID }: SectionHeaderProps) {
  const { locale } = useTranslation();
  return (
    <View style={styles.container} testID={testID}>
      <AppText variant="label" color={tone === 'danger' ? 'danger' : 'textSecondary'}>
        {title}
      </AppText>
      {typeof count === 'number' ? (
        <View style={styles.countBadge}>
          <AppText variant="caption" color="textSecondary">
            {formatNumber(count, locale)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
