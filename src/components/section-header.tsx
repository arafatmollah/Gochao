import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTranslation, formatNumber } from '@/i18n';
import { Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

import { AppText } from './app-text';

export interface SectionHeaderProps {
  title: string;
  count?: number;
  tone?: 'default' | 'danger';
  testID?: string;
  /** Overrides container spacing (e.g. no top pad when opening a list). */
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, count, tone = 'default', testID, style }: SectionHeaderProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { locale } = useTranslation();
  return (
    <View style={[styles.container, style]} testID={testID}>
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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
      backgroundColor: colors.background,
    },
    countBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: Spacing.xs,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
