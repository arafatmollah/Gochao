import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
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
import { Colors, IconSize, Spacing } from '@/theme/tokens';

export default function PrayerScreen() {
  const { t, locale } = useTranslation();
  const {
    date,
    day,
    next,
    prayedCount,
    loading,
    refreshing,
    error,
    notice,
    clearNotice,
    refresh,
    cycleStatus,
  } = usePrayerDay();

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
              highlighted={next?.prayer === item.prayer}
              onCycleStatus={() => void cycleStatus(item.prayer)}
              testID={`prayer-row-${item.prayer}`}
            />
          )}
          ItemSeparatorComponent={ListItemSeparator}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={refresh}
          ListHeaderComponent={
            <Card style={styles.nextCard}>
              <AppText variant="bodyStrong">{nextLine}</AppText>
              {next ? (
                <LiveTimer targetTime={next.time} tone="dark" testID="prayer-screen-timer" />
              ) : null}
              <AppText variant="caption" color="textSecondary">
                {t('prayer.daySummary', { prayed: prayedCount, total: day.prayers.length })}
              </AppText>
              <View style={styles.headerActions}>
                <Button
                  label={t('prayer.openSettings')}
                  variant="secondary"
                  size="sm"
                  onPress={openSettings}
                  icon={
                    <Ionicons name="settings-outline" size={IconSize.sm} color={Colors.text} />
                  }
                  testID="open-prayer-settings-button"
                />
                <Button
                  label={t('prayer.openHistory')}
                  variant="secondary"
                  size="sm"
                  onPress={openHistory}
                  icon={
                    <Ionicons name="time-outline" size={IconSize.sm} color={Colors.text} />
                  }
                  testID="open-prayer-history-button"
                />
              </View>
            </Card>
          }
          ListEmptyComponent={
            <EmptyState icon="moon-outline" title={t('prayer.title')} message={nextLine} />
          }
        />
      ) : null}
    </Screen>
  );
}

function ListItemSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
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
  separator: {
    height: Spacing.sm,
  },
  nextCard: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
});
