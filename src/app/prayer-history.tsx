import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { PrayerHistoryDay } from '@/features/prayer/components/prayer-history-day';
import { usePrayerHistory } from '@/features/prayer/hooks/use-prayer-history';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';

export default function PrayerHistoryScreen() {
  const { t } = useTranslation();
  const { days, loading, refreshing, error, refresh } = usePrayerHistory();

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        kicker={t('prayer.kicker')}
        title={t('prayer.historyTitle')}
        testID="prayer-history-header"
      />

      {loading ? (
        <LoadingState label={t('prayer.historyLoading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={days}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => (
            <PrayerHistoryDay day={item} testID={`prayer-history-${item.date}`} />
          )}
          ItemSeparatorComponent={ListItemSeparator}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={refresh}
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title={t('prayer.historyEmptyTitle')}
              message={t('prayer.historyEmptyMessage')}
            />
          }
        />
      )}
    </Screen>
  );
}

function ListItemSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    paddingTop: Spacing.xs,
    flexGrow: 1,
  },
  separator: {
    height: Spacing.sm,
  },
});
