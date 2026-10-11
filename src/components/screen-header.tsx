import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/theme/tokens';

import { AppText } from './app-text';

export interface ScreenHeaderProps {
  /** Small muted line above the title (e.g. the date or a count summary). */
  kicker?: string;
  /** Emphasizes the kicker (e.g. overdue counts). Defaults to muted. */
  kickerTone?: 'default' | 'danger';
  title: string;
  /** Optional trailing actions rendered on the kicker row. */
  right?: ReactNode;
  testID?: string;
}

/**
 * Two-line screen header matching the reference design: a small muted kicker
 * over a large title, with room for trailing actions.
 */
export function ScreenHeader({ kicker, kickerTone = 'default', title, right, testID }: ScreenHeaderProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.kickerRow}>
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
