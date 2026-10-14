import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { PrayerTimeRow } from '@/features/prayer/components/prayer-time-row';
import { LiveTimer } from '@/features/prayer/components/live-timer';
import { usePrayerDay } from '@/features/prayer/hooks/use-prayer-day';
import { formatIsoDateDisplay, formatWallClock12 } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { prayerWindowEnd, wallClockToMinutes } from '@/services/prayer-calculation';
import { IconSize, Radius, Spacing, type ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import { useMemo } from 'react';

export default function PrayerScreen() {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const {
    date,
    day,
    next,
    current,
    prayedCount,
    loading,
    refreshing,
    error,
    notice,
    clearNotice,
    refresh,
    cycleStatus,
  } = usePrayerDay();

  const styles = useMemo(() => makeStyles(colors), [colors]);

  function openSettings() {
    router.push('/prayer-settings');
  }

  function openHistory() {
    router.push('/prayer-history');
  }

  const nextLine = next
    ? t('prayer.nextPrayer', {
        name: t(`prayer.names.${next.prayer}`),
        time: formatWallClock12(next.time, locale),
      })
    : t('prayer.allDone');

  // Active window header: "Now: Dhuhr" plus its available span
  // ("11:45 AM – 3:45 PM"). Before Fajr there is no active prayer, so the
  // upcoming prayer and its countdown are shown instead.
  const focusName = current
    ? t(`prayer.names.${current.prayer}`)
    : next
      ? t(`prayer.names.${next.prayer}`)
      : null;
  const windowLine = current
    ? current.endTime
      ? t('prayer.timeWindow', {
          start: formatWallClock12(current.time, locale),
          end: formatWallClock12(current.endTime, locale),
        })
      : formatWallClock12(current.time, locale)
    : next
      ? formatWallClock12(next.time, locale)
      : null;
  const timerTarget = current?.endTime ?? (!current ? next?.time : undefined);

  // Elapsed share of the active window; recomputed on every render (the day
  // hook ticks every 30 seconds, so the bar stays live with no extra timer).
  let windowProgress: number | null = null;
  if (current?.endTime) {
    const startMinutes = wallClockToMinutes(current.time);
    const endMinutes = wallClockToMinutes(current.endTime);
    if (startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      windowProgress = Math.min(Math.max((nowMinutes - startMinutes) / (endMinutes - startMinutes), 0), 1);
    }
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        kicker={formatIsoDateDisplay(date, t)}
        title={t('prayer.title')}
        testID="prayer-header"
      />

      {notice ? (
        <View style={styles.bannerWrapper}>
          <Banner message={notice} onDismiss={clearNotice} />
        </View>
      ) : null}

      {loading ? (
        <LoadingState label={t('prayer.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : day ? (
        <FlatList
          data={day.prayers}
          keyExtractor={(item) => item.prayer}
          renderItem={({ item }) => (
            <PrayerTimeRow
              entry={item}
              highlighted={(current?.prayer ?? next?.prayer) === item.prayer}
              endTime={prayerWindowEnd(
                day.prayers.map(({ prayer, time }) => ({ prayer, time })),
                item.prayer,
              )}
              onCycleStatus={() => void cycleStatus(item.prayer)}
              testID={`prayer-row-${item.prayer}`}
            />
          )}
          ItemSeparatorComponent={ListSeparator}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={refresh}
          ListHeaderComponent={
            <>
              <LinearGradient
                colors={[colors.hero, colors.primaryPressed]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={styles.phaseBadge}>
                  <View style={styles.phaseDot} />
                  <AppText variant="label" style={styles.heroText}>
                    {current ? t('dashboard.prayerNowKicker') : t('dashboard.prayerNextKicker')}
                  </AppText>
                </View>
                <AppText variant="caption" style={styles.heroMutedText}>
                  {t('prayer.daySummary', { prayed: prayedCount, total: day.prayers.length })}
                </AppText>
              </View>

              {focusName ? (
                <AppText variant="heroValue" style={styles.heroName}>
                  {focusName}
                </AppText>
              ) : (
                <AppText variant="bodyStrong" style={styles.heroName}>
                  {t('prayer.allDone')}
                </AppText>
              )}

              {windowLine ? (
                <View style={styles.windowPill}>
                  <Ionicons name="time-outline" size={IconSize.sm} color={colors.heroText} />
                  <AppText variant="bodyStrong" style={styles.heroText}>
                    {windowLine}
                  </AppText>
                </View>
              ) : null}

              {timerTarget ? (
                <LiveTimer targetTime={timerTarget} tone="light" testID="prayer-screen-timer" />
              ) : null}

              {windowProgress !== null ? (
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${windowProgress * 100}%` }]} />
                </View>
              ) : null}

              <View style={styles.headerActions}>
                <Button
                  label={t('prayer.openSettings')}
                  variant="secondary"
                  size="sm"
                  onPress={openSettings}
                  icon={
                    <Ionicons name="settings-outline" size={IconSize.sm} color={colors.text} />
                  }
                  testID="open-prayer-settings-button"
                />
                <Button
                  label={t('prayer.openHistory')}
                  variant="secondary"
                  size="sm"
                  onPress={openHistory}
                  icon={
                    <Ionicons name="time-outline" size={IconSize.sm} color={colors.text} />
                  }
                  testID="open-prayer-history-button"
                />
              </View>
            </LinearGradient>
            </>
          }
          ListEmptyComponent={
            <EmptyState icon="moon-outline" title={t('prayer.title')} message={nextLine} />
          }
        />
      ) : null}
    </Screen>
  );
}

function ListSeparator() {
  // Separator height carries no color, so this stays static.
  return <View style={separatorStyles.separator} />;
}

const separatorStyles = StyleSheet.create({
  separator: {
    height: Spacing.sm,
  },
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bannerWrapper: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.sm,
    },
    listContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxxl,
      paddingTop: Spacing.xs,
      flexGrow: 1,
    },
    heroCard: {
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
      borderRadius: Radius.xl,
      padding: Spacing.xl,
      overflow: 'hidden',
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    phaseBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      borderRadius: Radius.pill,
      backgroundColor: colors.heroTrack,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    phaseDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.heroText,
    },
    heroText: {
      color: colors.heroText,
    },
    heroMutedText: {
      color: colors.heroMuted,
    },
    heroName: {
      color: colors.heroText,
    },
    windowPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: Spacing.xs,
      borderRadius: Radius.pill,
      backgroundColor: colors.heroTrack,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
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
    headerActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      paddingTop: Spacing.sm,
    },
  });
