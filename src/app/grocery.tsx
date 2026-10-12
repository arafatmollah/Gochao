import { router } from 'expo-router';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/banner';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SearchField } from '@/components/search-field';
import { GroceryListCard } from '@/features/grocery/components/grocery-list-card';
import { useGroceryLists, type GroceryListTab } from '@/features/grocery/hooks/use-grocery-lists';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';
import type { GroceryListSummary } from '@/types/grocery';

const TABS: GroceryListTab[] = ['active', 'archived'];

export default function GroceryScreen() {
  const { t } = useTranslation();
  const {
    lists,
    loading,
    refreshing,
    error,
    notice,
    clearNotice,
    tab,
    setTab,
    search,
    setSearch,
    refresh,
  } = useGroceryLists();

  function openNewList() {
    router.push('/grocery-list-form');
  }

  function openList(list: GroceryListSummary) {
    router.push({ pathname: '/grocery-detail', params: { id: list.id } });
  }

  const filtering = search.trim().length > 0;

  const kicker =
    tab === 'active'
      ? t('grocery.activeCount', { count: lists.length })
      : t('grocery.archivedCount', { count: lists.length });

  return (
    <Screen edges={['top']}>
      <ScreenHeader kicker={kicker} title={t('grocery.title')} testID="grocery-header" />

      {notice ? (
        <View style={styles.bannerWrapper}>
          <Banner message={notice} onDismiss={clearNotice} />
        </View>
      ) : null}

      <View style={styles.controls}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder={t('grocery.searchPlaceholder')}
          testID="grocery-search"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled">
          {TABS.map((value) => (
            <Chip
              key={value}
              label={t(`grocery.filters.${value}`)}
              selected={tab === value}
              onPress={() => setTab(value)}
              testID={`grocery-tab-${value}`}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <LoadingState label={t('grocery.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GroceryListCard
              list={item}
              onPress={openList}
              testID={`grocery-list-${item.id}`}
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
                title={t('grocery.noMatchesTitle')}
                message={t('grocery.noMatchesMessage')}
              />
            ) : (
              <EmptyState
                icon="cart-outline"
                title={t('grocery.emptyTitle')}
                message={t('grocery.emptyMessage')}
                actionLabel={tab === 'active' ? t('grocery.addList') : undefined}
                onAction={tab === 'active' ? openNewList : undefined}
              />
            )
          }
        />
      )}

      <Fab
        onPress={openNewList}
        accessibilityLabel={t('grocery.addListA11y')}
        testID="add-grocery-list-fab"
      />
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
});
