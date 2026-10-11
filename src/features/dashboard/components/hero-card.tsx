import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTranslation, formatNumber } from '@/i18n';
import { Colors, Radius, Spacing } from '@/theme/tokens';

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
  const { t, locale } = useTranslation();
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.hero,
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
    color: Colors.heroMuted,
  },
  badge: {
    backgroundColor: Colors.heroTrack,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    color: Colors.heroText,
    fontWeight: '600',
  },
  value: {
    color: Colors.heroText,
  },
  subCaption: {
    color: Colors.heroMuted,
    marginBottom: Spacing.md,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.heroTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.heroText,
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
    backgroundColor: Colors.heroTrack,
    marginHorizontal: Spacing.md,
  },
  columnLabel: {
    color: Colors.heroMuted,
  },
  overdueValue: {
    color: Colors.heroNegative,
  },
  dueTodayValue: {
    color: Colors.heroPositive,
  },
});
