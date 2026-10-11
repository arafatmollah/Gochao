import { router } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/banner';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeader } from '@/components/section-header';
import { BillRow } from '@/features/bills/components/bill-row';
import { OccurrenceCard } from '@/features/bills/components/occurrence-card';
import type { BillDueSection } from '@/features/bills/grouping';
import { useBills, type BillsSegment } from '@/features/bills/hooks/use-bills';
import { useTranslation } from '@/i18n';
import { Colors, Spacing } from '@/theme/tokens';
import type { BillDueItem } from '@/types/bill';

const SEGMENTS: BillsSegment[] = ['due', 'bills', 'history'];

export default function BillsScreen() {
  const { t } = useTranslation();
  const {
    segment,
    setSegment,
    dueSections,
    dueCount,
    overdueCount,
    summaries,
    history,
    historyHasMore,
    today,
    loading,
    refreshing,
    loadingMore,
    error,
    notice,
    clearNotice,
    refresh,
    loadMoreHistory,
  } = useBills();

  function openNewBill() {
    router.push('/bill-form');
  }

  function openBill(billId: string) {
    router.push({ pathname: '/bill-detail', params: { id: billId } });
  }

  function openPayment(occurrence: BillDueItem) {
    router.push({ pathname: '/bill-pay', params: { occurrenceId: occurrence.id } });
  }

  const kicker =
    segment === 'due'
      ? overdueCount > 0
        ? t('bills.dueSummaryOverdue', { due: dueCount, overdue: overdueCount })
        : t('bills.dueSummary', { count: dueCount })
      : undefined;

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={refresh}
      tintColor={Colors.primary}
      colors={[Colors.primary]}
    />
  );

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        kicker={kicker}
        kickerTone={overdueCount > 0 && segment === 'due' ? 'danger' : 'default'}
        title={t('bills.title')}
        testID="bills-header"
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
            label={t(`bills.segments.${value}`)}
            selected={segment === value}
            onPress={() => setSegment(value)}
            testID={`bills-segment-${value}`}
          />
        ))}
      </View>

      {loading ? (
        <LoadingState label={t('bills.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : segment === 'due' ? (
        <SectionList<BillDueItem, BillDueSection>
          sections={dueSections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OccurrenceCard
              occurrence={item}
              category={item.billCategory}
              billName={item.billName}
              today={today}
              variant="due"
              onPress={() => openBill(item.billId)}
              actionLabel={t('bills.detail.recordPayment')}
              onAction={() => openPayment(item)}
              testID={`bill-due-${item.id}`}
            />
          )}
          renderSectionHeader={({ section }) => (
            <SectionHeader
              title={t(`bills.sections.${section.key}`)}
              count={section.data.length}
              tone={section.tone}
            />
          )}
          ItemSeparatorComponent={ListItemSeparator}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          refreshControl={refreshControl}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={t('bills.due.emptyTitle')}
              message={t('bills.due.emptyMessage')}
            />
          }
        />
      ) : segment === 'bills' ? (
        <FlatList
          data={summaries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BillRow
              summary={item}
              today={today}
              onPress={() => openBill(item.id)}
              testID={`bill-row-${item.id}`}
            />
          )}
          ItemSeparatorComponent={ListItemSeparator}
          contentContainerStyle={styles.listContent}
          refreshControl={refreshControl}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={t('bills.list.emptyTitle')}
              message={t('bills.list.emptyMessage')}
              actionLabel={t('bills.list.addBill')}
              onAction={openNewBill}
            />
          }
        />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OccurrenceCard
              occurrence={item}
              category={item.billCategory}
              billName={item.billName}
              today={today}
              variant="history"
              onPress={() => openBill(item.billId)}
              testID={`bill-history-${item.id}`}
            />
          )}
          ItemSeparatorComponent={ListItemSeparator}
          contentContainerStyle={styles.listContent}
          refreshControl={refreshControl}
          onEndReached={historyHasMore ? loadMoreHistory : undefined}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-outline"
              title={t('bills.history.emptyTitle')}
              message={t('bills.history.emptyMessage')}
            />
          }
        />
      )}

      <Fab
        onPress={openNewBill}
        accessibilityLabel={t('bills.list.addBillA11y')}
        testID="add-bill-fab"
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
  segmentRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 96,
    flexGrow: 1,
  },
  separator: {
    height: Spacing.sm,
  },
  footer: {
    paddingVertical: Spacing.lg,
  },
});
