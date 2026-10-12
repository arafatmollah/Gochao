import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SearchField } from '@/components/search-field';
import { GroceryItemRow } from '@/features/grocery/components/grocery-item-row';
import {
  useGroceryDetail,
} from '@/features/grocery/hooks/use-grocery-detail';
import { useTranslation } from '@/i18n';
import { formatMoney } from '@/i18n/format';
import { Colors, IconSize, Spacing } from '@/theme/tokens';
import type { GroceryItemStatusFilter, GroceryItemWithMember } from '@/types/grocery';

const STATUS_FILTERS: GroceryItemStatusFilter[] = ['all', 'remaining', 'purchased'];

export default function GroceryDetailScreen() {
  const { t, locale } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const listId = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;
  const {
    list,
    items,
    totalItems,
    remainingCount,
    estimatedTotalMinor,
    actualTotalMinor,
    loading,
    refreshing,
    error,
    notice,
    clearNotice,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    refresh,
    togglePurchased,
    toggleArchived,
  } = useGroceryDetail(listId);

  function openNewItem() {
    if (!listId) {
      return;
    }
    router.push({ pathname: '/grocery-item-form', params: { listId } });
  }

  function openItem(item: GroceryItemWithMember) {
    router.push({ pathname: '/grocery-item-form', params: { id: item.id } });
  }

  function openEditList() {
    if (!listId) {
      return;
    }
    router.push({ pathname: '/grocery-list-form', params: { id: listId } });
  }

  if (!listId) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={t('grocery.title')} testID="grocery-detail-header" />
        <ErrorState message={t('errors.notFound')} onRetry={() => router.back()} />
      </Screen>
    );
  }

  const filtering = search.trim().length > 0 || statusFilter !== 'all';

  const kicker = list
    ? totalItems === 0
      ? undefined
      : remainingCount === 0
        ? t('grocery.allPurchased')
        : t('grocery.remaining', { count: remainingCount })
    : undefined;

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        kicker={kicker}
        title={list?.name ?? t('grocery.title')}
        testID="grocery-detail-header"
      />

      {notice ? (
        <View style={styles.bannerWrapper}>
          <Banner message={notice} onDismiss={clearNotice} />
        </View>
      ) : null}

      {loading ? (
        <LoadingState label={t('grocery.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <>
          <View style={styles.controls}>
            <Card style={styles.totalsCard}>
              <View style={styles.totalRow}>
                <AppText variant="caption" color="textSecondary">
                  {t('grocery.estimatedTotal')}
                </AppText>
                <AppText variant="bodyStrong">{formatMoney(estimatedTotalMinor, locale)}</AppText>
              </View>
              <View style={styles.totalRow}>
                <AppText variant="caption" color="textSecondary">
                  {t('grocery.actualTotal')}
                </AppText>
                <AppText variant="bodyStrong">{formatMoney(actualTotalMinor, locale)}</AppText>
              </View>
            </Card>

            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder={t('grocery.detailSearchPlaceholder')}
              testID="grocery-item-search"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled">
              {STATUS_FILTERS.map((value) => (
                <Chip
                  key={value}
                  label={t(`grocery.filters.${value}`)}
                  selected={statusFilter === value}
                  onPress={() => setStatusFilter(value)}
                  testID={`grocery-item-filter-${value}`}
                />
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <GroceryItemRow
                item={item}
                onPress={openItem}
                onToggle={(toggled) => void togglePurchased(toggled)}
                testID={`grocery-item-${item.id}`}
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
                  title={t('grocery.detailEmptySearchTitle')}
                  message={t('grocery.detailEmptySearchMessage')}
                />
              ) : (
                <EmptyState
                  icon="basket-outline"
                  title={t('grocery.detailEmptyTitle')}
                  message={t('grocery.detailEmptyMessage')}
                  actionLabel={t('grocery.addItem')}
                  onAction={openNewItem}
                />
              )
            }
            ListFooterComponent={
              list ? (
                <View style={styles.footerActions}>
                  <Button
                    label={t('grocery.editList')}
                    variant="secondary"
                    size="sm"
                    onPress={openEditList}
                    icon={
                      <Ionicons name="pencil-outline" size={IconSize.sm} color={Colors.text} />
                    }
                    testID="edit-grocery-list-button"
                  />
                  <Button
                    label={
                      list.isArchived ? t('grocery.restoreList') : t('grocery.archiveList')
                    }
                    variant="secondary"
                    size="sm"
                    onPress={() => void toggleArchived()}
                    icon={
                      <Ionicons
                        name={list.isArchived ? 'refresh-outline' : 'archive-outline'}
                        size={IconSize.sm}
                        color={Colors.text}
                      />
                    }
                    testID="archive-grocery-list-button"
                  />
                </View>
              ) : null
            }
          />
        </>
      )}

      <Fab
        onPress={openNewItem}
        accessibilityLabel={t('grocery.addItemA11y')}
        testID="add-grocery-item-fab"
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
  totalsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  totalRow: {
    gap: 2,
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
  footerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
  },
});
