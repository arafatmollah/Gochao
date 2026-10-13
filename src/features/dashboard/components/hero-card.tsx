import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTranslation, formatNumber } from '@/i18n';
import { useAppTheme } from '@/theme/theme-context';
import { Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';

import type { DashboardSummary } from '../summary';

export interface HeroCardProps {
  summary: DashboardSummary;
  testID?: string;
}

/**
 * Navy summary card (reference design): today's pending work with a progress
 * bar and overdue / due-today columns. Every figure comes from the database
 * via `DashboardSummary`.
 */
export function HeroCard({ summary, testID }: HeroCardProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const hasToday = summary.todayTotal > 0;
  const percent = Math.round(summary.progress * 100);

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.topRow}>
        <AppText variant="label" style={styles.kicker}>
          {t('dashboard.todayTasks')}
        </AppText>
        {hasToday ? (
          <View style={styles.badge}>
            <AppText variant="caption" style={styles.badgeText}>
              {t('dashboard.progressBadge', { percent })}
            </AppText>
          </View>
        ) : null}
      </View>

      <AppText variant="heroValue" style={styles.value}>
        {formatNumber(summary.pendingDueCount, locale)}
      </AppText>
      <AppText variant="caption" style={styles.subCaption}>
        {hasToday ? t('dashboard.stillToDo') : t('dashboard.nothingDueTitle')}
      </AppText>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <AppText variant="caption" style={styles.columnLabel}>
            {t('dashboard.overdueColumn')}
          </AppText>
          <AppText variant="bodyStrong" style={styles.overdueValue}>
            {formatNumber(summary.overdueCount, locale)}
          </AppText>
        </View>
        <View style={styles.columnDivider} />
        <View style={styles.column}>
          <AppText variant="caption" style={styles.columnLabel}>
            {t('dashboard.dueTodayColumn')}
          </AppText>
          <AppText variant="bodyStrong" style={styles.dueTodayValue}>
            {formatNumber(summary.dueTodayCount, locale)}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.hero,
      borderRadius: Radius.xl,
      padding: Spacing.xl,
      gap: Spacing.xs,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    kicker: {
      color: colors.heroMuted,
    },
    badge: {
      backgroundColor: colors.heroTrack,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
    },
    badgeText: {
      color: colors.heroText,
      fontWeight: '600',
    },
    value: {
      color: colors.heroText,
    },
    subCaption: {
      color: colors.heroMuted,
      marginBottom: Spacing.md,
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.heroTrack,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: colors.heroText,
    },
    columns: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    column: {
      flex: 1,
      gap: 2,
    },
    columnDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: colors.heroTrack,
      marginHorizontal: Spacing.md,
    },
    columnLabel: {
      color: colors.heroMuted,
    },
    overdueValue: {
      color: colors.heroNegative,
    },
    dueTodayValue: {
      color: colors.heroPositive,
    },
  });
