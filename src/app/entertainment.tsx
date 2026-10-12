import { router } from 'expo-router';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SearchField } from '@/components/search-field';
import { SectionHeader } from '@/components/section-header';
import { SpotlightCard } from '@/features/entertainment/components/spotlight-card';
import { WatchlistRow } from '@/features/entertainment/components/watchlist-row';
import {
  useEntertainment,
  type EntertainmentSegment,
  type SpotlightWithSaved,
  type WatchStatusFilter,
} from '@/features/entertainment/hooks/use-entertainment';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';
import { WATCH_KINDS, WATCH_STATUSES, type WatchItem, type WatchKind } from '@/types/entertainment';

const SEGMENTS: EntertainmentSegment[] = ['watchlist', 'discover'];
const STATUS_FILTERS: WatchStatusFilter[] = ['all', ...WATCH_STATUSES];

export default function EntertainmentScreen() {
  const { t } = useTranslation();
  const {
    segment,
    setSegment,
    items,
    upcoming,
    acclaimed,
    loading,
    refreshing,
    error,
    notice,
    clearNotice,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    kindFilter,
    setKindFilter,
    refresh,
    saveSpotlight,
    openLink,
  } = useEntertainment();

  function openNewItem() {
    router.push('/entertainment-form');
  }

  function openItem(item: WatchItem) {
    router.push({ pathname: '/entertainment-form', params: { id: item.id } });
  }

  const filtering =
    search.trim().length > 0 || statusFilter !== 'all' || kindFilter !== null;

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        kicker={t('entertainment.kicker')}
        title={t('entertainment.title')}
        testID="entertainment-header"
      />

      {notice ? (
        <View style={styles.bannerWrapper}>
          <Banner message={notice} onDismiss={clearNotice} />
        </View>
      ) : null}

      <View style={styles.segmentRow}>
        {SEGMENTS.map((value) => (
          <Chip
            key={value}
            label={t(`entertainment.segments.${value}`)}
            selected={segment === value}
            onPress={() => setSegment(value)}
            testID={`entertainment-segment-${value}`}
          />
        ))}
      </View>

      {loading ? (
        <LoadingState label={t('entertainment.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : segment === 'watchlist' ? (
        <View style={styles.flex}>
          <View style={styles.controls}>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder={t('entertainment.searchPlaceholder')}
              testID="entertainment-search"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled">
              {STATUS_FILTERS.map((value) => (
                <Chip
                  key={value}
                  label={
                    value === 'all'
                      ? t('entertainment.filters.all')
                      : t(`entertainment.filters.${value}`)
                  }
                  selected={statusFilter === value}
                  onPress={() => setStatusFilter(value)}
                  testID={`entertainment-status-${value}`}
                />
              ))}
              {WATCH_KINDS.map((kind: WatchKind) => (
                <Chip
                  key={kind}
                  label={t(`entertainment.kinds.${kind}`)}
                  selected={kindFilter === kind}
                  onPress={() => setKindFilter(kindFilter === kind ? null : kind)}
                  testID={`entertainment-kind-${kind}`}
                />
              ))}
            </ScrollView>
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <WatchlistRow
                item={item}
                onPress={openItem}
                onOpenLink={(url) => void openLink(url)}
                testID={`watch-item-${item.id}`}
              />
            )}
            ItemSeparatorComponent={ListItemSeparator}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={refresh}
            ListEmptyComponent={
              filtering ? (
                <EmptyState
                  icon="search-outline"
                  title={t('entertainment.noMatchesTitle')}
                  message={t('entertainment.noMatchesMessage')}
                />
              ) : (
                <EmptyState
                  icon="film-outline"
                  title={t('entertainment.emptyTitle')}
                  message={t('entertainment.emptyMessage')}
                  actionLabel={t('entertainment.addTitle')}
                  onAction={openNewItem}
                />
              )
            }
          />
        </View>
      ) : (
        <DiscoverList
          upcoming={upcoming}
          acclaimed={acclaimed}
          refreshing={refreshing}
          onRefresh={refresh}
          onAdd={(entry) => void saveSpotlight(entry)}
        />
      )}

      <Fab
        onPress={openNewItem}
        accessibilityLabel={t('entertainment.addTitleA11y')}
        testID="add-watch-fab"
      />
    </Screen>
  );
}

function DiscoverList({
  upcoming,
  acclaimed,
  refreshing,
  onRefresh,
  onAdd,
}: {
  upcoming: SpotlightWithSaved[];
  acclaimed: SpotlightWithSaved[];
  refreshing: boolean;
  onRefresh: () => void;
  onAdd: (entry: SpotlightWithSaved) => void;
}) {
  const { t } = useTranslation();
  const sections = [
    {
      key: 'upcoming',
      title: t('entertainment.upcomingTitle'),
      hint: t('entertainment.upcomingHint'),
      data: upcoming,
    },
    {
      key: 'acclaimed',
      title: t('entertainment.acclaimedTitle'),
      hint: t('entertainment.acclaimedHint'),
      data: acclaimed,
    },
  ];
  return (
    <FlatList
      data={sections}
      keyExtractor={(section) => section.key}
      renderItem={({ item: section, index }) => (
        <View style={styles.discoverSection}>
          <SectionHeader
            title={section.title}
            count={section.data.length}
            style={index === 0 ? styles.firstSectionHeader : undefined}
          />
          <AppText variant="caption" color="textSecondary">
            {section.hint}
          </AppText>
          <View style={styles.discoverCards}>
            {section.data.map((entry) => (
              <SpotlightCard
                key={entry.id}
                entry={entry}
                onAdd={onAdd}
                testID={`spotlight-${entry.id}`}
              />
            ))}
          </View>
        </View>
      )}
      contentContainerStyle={styles.listContent}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ItemSeparatorComponent={ListItemSeparator}
    />
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
  segmentRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  controls: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  chipRow: {
    gap: Spacing.sm,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 96,
    paddingTop: Spacing.xs,
    flexGrow: 1,
  },
  separator: {
    height: Spacing.sm,
  },
  flex: {
    flex: 1,
  },
  discoverSection: {
    gap: Spacing.sm,
  },
  /** First section opens the list: no extra top pad (matches flat lists). */
  firstSectionHeader: {
    paddingTop: 0,
  },
  discoverCards: {
    gap: Spacing.sm,
  },
});
