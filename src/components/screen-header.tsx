import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Colors, IconSize, Spacing } from '@/theme/tokens';

import { AppText } from './app-text';

export interface ScreenHeaderProps {
  /** Small muted line above the title (e.g. the date or a count summary). */
  kicker?: string;
  /** Emphasizes the kicker (e.g. overdue counts). Defaults to muted. */
  kickerTone?: 'default' | 'danger';
  title: string;
  /** Optional trailing actions rendered on the kicker row. */
  right?: ReactNode;
  /** Shows a back chevron that calls this handler (for headerless screens). */
  onBack?: () => void;
  testID?: string;
}

/**
 * Two-line screen header matching the reference design: a small muted kicker
 * over a large title, with room for trailing actions.
 */
export function ScreenHeader({ kicker, kickerTone = 'default', title, right, onBack, testID }: ScreenHeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.kickerRow}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            testID={testID ? `${testID}-back` : 'screen-header-back'}
            style={styles.backButton}>
            <Ionicons name="chevron-back" size={IconSize.md} color={Colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.kickerColumn}>
          {kicker ? (
            <AppText
              variant="caption"
              color={kickerTone === 'danger' ? 'danger' : 'textSecondary'}
              numberOfLines={1}>
              {kicker}
            </AppText>
          ) : null}
          <AppText variant="title" numberOfLines={1}>
            {title}
          </AppText>
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.sm,
  },
  kickerColumn: {
    flex: 1,
    gap: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
