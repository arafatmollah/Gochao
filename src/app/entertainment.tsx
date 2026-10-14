import { router } from 'expo-router';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SearchField } from '@/components/search-field';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { IntelligenceCard } from '@/features/entertainment/components/intelligence-card';
import { SpotlightCard } from '@/features/entertainment/components/spotlight-card';
import { WatchlistRow } from '@/features/entertainment/components/watchlist-row';
import {
  useEntertainment,
  type EntertainmentSegment,
  type SpotlightWithSaved,
  type WatchStatusFilter,
} from '@/features/entertainment/hooks/use-entertainment';
import { formatIsoDateDisplay, formatWallClock12 } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';
import { WATCH_KINDS, WATCH_STATUSES, type WatchItem, type WatchKind } from '@/types/entertainment';

function formatSyncTime(
  iso: string,
  t: (key: string, params?: Record<string, string | number>) => string,
  locale: 'en' | 'bn',
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${formatIsoDateDisplay(day, t)} · ${formatWallClock12(`${pad(date.getHours())}:${pad(date.getMinutes())}`, locale)}`;
}

const SEGMENTS: EntertainmentSegment[] = ['library', 'upcoming', 'marvel', 'for_you', 'episodes'];
const STATUS_FILTERS: WatchStatusFilter[] = ['all', ...WATCH_STATUSES];
const PROVIDER_FILTERS: ('all' | 'netflix' | 'prime' | 'max')[] = ['all', 'netflix', 'prime', 'max'];

export default function EntertainmentScreen() {
  const { t } = useTranslation();
  const {
    segment,
    setSegment,
    items,
    upcomingList,
    marvelList,
    forYouList,
    episodesList,
    forYouProvider,
    setForYouProvider,
    upcoming,
    acclaimed,
    marvelFeed,
    trendingFeed,
    premiereFeed,
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
    apiKey,
    apiKeyInput,
    setApiKeyInput,
    savingKey,
    saveApiKey,
    lastSyncAt,
    syncing,
    syncError,
    syncNow,
  } = useEntertainment();

  function openNewItem() {
    router.push('/entertainment-form');
  }

  function openItem(item: WatchItem) {
    router.push({ pathname: '/entertainment-form', params: { id: item.id } });
  }

  const filtering = search.trim().length > 0 || statusFilter !== 'all' || kindFilter !== null;

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled">
          {SEGMENTS.map((value) => {
            const isSelected =
              segment === value || (value === 'library' && segment === 'watchlist');
            return (
              <Chip
                key={value}
                label={t(`entertainment.segments.${value}`)}
                selected={isSelected}
                onPress={() => setSegment(value)}
                testID={`entertainment-segment-${value}`}
              />
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <LoadingState label={t('entertainment.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : segment === 'library' || segment === 'watchlist' ? (
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
      ) : segment === 'upcoming' ? (
        <FlatList
          data={upcomingList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <IntelligenceCard
              item={item}
              onAdd={(entry) => void saveSpotlight(entry)}
              testID={`upcoming-${item.id}`}
            />
          )}
          ItemSeparatorComponent={ListItemSeparator}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={refresh}
          ListHeaderComponent={
            <SyncCard
              apiKey={apiKey}
              apiKeyInput={apiKeyInput}
              onApiKeyInput={setApiKeyInput}
              savingKey={savingKey}
              onSaveApiKey={() => void saveApiKey()}
              lastSyncAt={lastSyncAt}
              syncing={syncing}
              syncError={syncError}
              onSyncNow={() => void syncNow()}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title={t('entertainment.emptyUpcomingTitle')}
              message={t('entertainment.emptyUpcomingMessage')}
            />
          }
        />
      ) : segment === 'marvel' ? (
        <FlatList
          data={marvelList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <IntelligenceCard
              item={item}
              onAdd={(entry) => void saveSpotlight(entry)}
              testID={`marvel-${item.id}`}
            />
          )}
          ItemSeparatorComponent={ListItemSeparator}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={refresh}
          ListHeaderComponent={
            <View style={styles.sectionHeaderCard}>
              <SectionHeader
                title={t('entertainment.marvelTitle')}
                count={marvelList.length}
              />
              <AppText variant="caption" color="textSecondary">
                {t('entertainment.marvelHint')}
              </AppText>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="shield-checkmark-outline"
              title={t('entertainment.emptyMarvelTitle')}
              message={t('entertainment.emptyMarvelMessage')}
            />
          }
        />
      ) : segment === 'for_you' ? (
        <View style={styles.flex}>
          <View style={styles.providerFilterRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled">
              {PROVIDER_FILTERS.map((p) => (
                <Chip
                  key={p}
                  label={
                    p === 'all'
                      ? t('entertainment.forYouFilterAll')
                      : p === 'netflix'
                        ? t('entertainment.forYouFilterNetflix')
                        : p === 'prime'
                          ? t('entertainment.forYouFilterPrime')
                          : t('entertainment.forYouFilterMax')
                  }
                  selected={forYouProvider === p}
                  onPress={() => setForYouProvider(p)}
                  testID={`for-you-provider-${p}`}
                />
              ))}
            </ScrollView>
          </View>
          <FlatList
            data={forYouList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <IntelligenceCard
                item={item}
                onAdd={(entry) => void saveSpotlight(entry)}
                testID={`foryou-${item.id}`}
              />
            )}
            ItemSeparatorComponent={ListItemSeparator}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={refresh}
            ListHeaderComponent={
              <SyncCard
                apiKey={apiKey}
                apiKeyInput={apiKeyInput}
                onApiKeyInput={setApiKeyInput}
                savingKey={savingKey}
                onSaveApiKey={() => void saveApiKey()}
                lastSyncAt={lastSyncAt}
                syncing={syncing}
                syncError={syncError}
                onSyncNow={() => void syncNow()}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="sparkles-outline"
                title={t('entertainment.emptyForYouTitle')}
                message={t('entertainment.emptyForYouMessage')}
              />
            }
          />
        </View>
      ) : segment === 'episodes' ? (
        <FlatList
          data={episodesList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <IntelligenceCard
              item={item}
              onAdd={(entry) => void saveSpotlight(entry)}
              testID={`episodes-${item.id}`}
            />
          )}
          ItemSeparatorComponent={ListItemSeparator}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={refresh}
          ListHeaderComponent={
            <View style={styles.sectionHeaderCard}>
              <SectionHeader
                title={t('entertainment.segments.episodes')}
                count={episodesList.length}
              />
              <AppText variant="caption" color="textSecondary">
                {t('entertainment.premieresHint')}
              </AppText>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="tv-outline"
              title={t('entertainment.emptyEpisodesTitle')}
              message={t('entertainment.emptyEpisodesMessage')}
            />
          }
        />
      ) : (
        /* Legacy discover feed for backwards compatibility */
        <DiscoverList
          upcoming={upcoming}
          acclaimed={acclaimed}
          marvelFeed={marvelFeed}
          trendingFeed={trendingFeed}
          premiereFeed={premiereFeed}
          refreshing={refreshing}
          onRefresh={refresh}
          onAdd={(entry) => void saveSpotlight(entry)}
          apiKey={apiKey}
          apiKeyInput={apiKeyInput}
          onApiKeyInput={setApiKeyInput}
          savingKey={savingKey}
          onSaveApiKey={() => void saveApiKey()}
          lastSyncAt={lastSyncAt}
          syncing={syncing}
          syncError={syncError}
          onSyncNow={() => void syncNow()}
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
  marvelFeed,
  trendingFeed,
  premiereFeed,
  refreshing,
  onRefresh,
  onAdd,
  apiKey,
  apiKeyInput,
  onApiKeyInput,
  savingKey,
  onSaveApiKey,
  lastSyncAt,
  syncing,
  syncError,
  onSyncNow,
}: {
  upcoming: SpotlightWithSaved[];
  acclaimed: SpotlightWithSaved[];
  marvelFeed: SpotlightWithSaved[];
  trendingFeed: SpotlightWithSaved[];
  premiereFeed: SpotlightWithSaved[];
  refreshing: boolean;
  onRefresh: () => void;
  onAdd: (entry: SpotlightWithSaved) => void;
  apiKey: string | null;
  apiKeyInput: string;
  onApiKeyInput: (value: string) => void;
  savingKey: boolean;
  onSaveApiKey: () => void;
  lastSyncAt: string | null;
  syncing: boolean;
  syncError: string | null;
  onSyncNow: () => void;
}) {
  const { t } = useTranslation();
  const sections = [
    ...(premiereFeed.length > 0
      ? [
          {
            key: 'premieres',
            title: t('entertainment.premieresTitle'),
            hint: t('entertainment.premieresHint'),
            data: premiereFeed,
          },
        ]
      : []),
    ...(marvelFeed.length > 0
      ? [
          {
            key: 'marvel',
            title: t('entertainment.marvelTitle'),
            hint: t('entertainment.marvelHint'),
            data: marvelFeed,
          },
        ]
      : []),
    ...(trendingFeed.length > 0
      ? [
          {
            key: 'trending',
            title: t('entertainment.trendingTitle'),
            hint: t('entertainment.trendingHint'),
            data: trendingFeed,
          },
        ]
      : []),
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
      ListHeaderComponent={
        <SyncCard
          apiKey={apiKey}
          apiKeyInput={apiKeyInput}
          onApiKeyInput={onApiKeyInput}
          savingKey={savingKey}
          onSaveApiKey={onSaveApiKey}
          lastSyncAt={lastSyncAt}
          syncing={syncing}
          syncError={syncError}
          onSyncNow={onSyncNow}
        />
      }
    />
  );
}

function SyncCard({
  apiKey,
  apiKeyInput,
  onApiKeyInput,
  savingKey,
  onSaveApiKey,
  lastSyncAt,
  syncing,
  syncError,
  onSyncNow,
}: {
  apiKey: string | null;
  apiKeyInput: string;
  onApiKeyInput: (value: string) => void;
  savingKey: boolean;
  onSaveApiKey: () => void;
  lastSyncAt: string | null;
  syncing: boolean;
  syncError: string | null;
  onSyncNow: () => void;
}) {
  const { t, locale } = useTranslation();
  if (!apiKey) {
    return (
      <View style={styles.discoverSection}>
        <SectionHeader title={t('entertainment.syncTitle')} />
        <AppText variant="caption" color="textSecondary">
          {t('entertainment.syncHint')}
        </AppText>
        <TextField
          label={t('entertainment.apiKeyLabel')}
          value={apiKeyInput}
          onChangeText={onApiKeyInput}
          placeholder={t('entertainment.apiKeyPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          testID="entertainment-api-key-input"
        />
        <Button
          label={t('entertainment.apiSave')}
          onPress={onSaveApiKey}
          loading={savingKey}
          testID="entertainment-api-save"
        />
      </View>
    );
  }

  return (
    <View style={styles.syncStatusWrapper}>
      {syncError ? <Banner message={syncError} /> : null}
      <View style={styles.syncStatusRow}>
        <AppText variant="caption" color="textSecondary">
          {lastSyncAt
            ? t('entertainment.lastSync', { when: formatSyncTime(lastSyncAt, t, locale) })
            : t('entertainment.neverSynced')}
        </AppText>
        <Button
          label={t('entertainment.syncNow')}
          size="sm"
          variant="secondary"
          onPress={onSyncNow}
          loading={syncing}
          testID="entertainment-sync-now"
        />
      </View>
    </View>
  );
}

function ListItemSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bannerWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  segmentRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  providerFilterRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  controls: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },
  separator: {
    height: Spacing.xs,
  },
  sectionHeaderCard: {
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  discoverSection: {
    gap: Spacing.sm,
  },
  firstSectionHeader: {
    paddingTop: 0,
  },
  discoverCards: {
    gap: Spacing.sm,
  },
  syncStatusWrapper: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
});
