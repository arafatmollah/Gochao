import { router } from 'expo-router';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/banner';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SearchField } from '@/components/search-field';
import { MemberRow } from '@/features/family/components/member-row';
import { RequestCard } from '@/features/family/components/request-card';
import {
  REQUEST_STATUS_FILTERS,
  useFamily,
  type FamilySegment,
} from '@/features/family/hooks/use-family';
import { requestStatusLabelKey } from '@/features/family/meta';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

const SEGMENTS: FamilySegment[] = ['requests', 'members'];

export default function FamilyScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const {
    segment,
    setSegment,
    statusFilter,
    setStatusFilter,
    memberFilterId,
    setMemberFilterId,
    search,
    setSearch,
    requests,
    members,
    filterMembers,
    loading,
    refreshing,
    error,
    notice,
    clearNotice,
    refresh,
  } = useFamily();

  function openNewRequest() {
    router.push('/request-form');
  }

  function openRequest(id: string) {
    router.push({ pathname: '/request-form', params: { id } });
  }

  function openNewMember() {
    router.push('/member-form');
  }

  function openMember(id: string) {
    router.push({ pathname: '/member-form', params: { id } });
  }

  const filtering =
    search.trim().length > 0 || statusFilter !== 'all' || memberFilterId !== null;

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={refresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
    />
  );

  function goBack() {
    // The native header is hidden (custom ScreenHeader instead), so the
    // screen owns its back affordance. Deep links may have no history.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/more');
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        kicker={t('family.kicker')}
        title={t('family.title')}
        onBack={goBack}
        testID="family-header"
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
            label={t(`family.segments.${value}`)}
            selected={segment === value}
            onPress={() => setSegment(value)}
            testID={`family-segment-${value}`}
          />
        ))}
      </View>

      {loading ? (
        <LoadingState label={t('family.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : segment === 'requests' ? (
        <>
          <View style={styles.searchRow}>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder={t('family.searchPlaceholder')}
              testID="family-search"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}>
            {REQUEST_STATUS_FILTERS.map((value) => (
              <Chip
                key={value}
                label={
                  value === 'all' ? t('family.filters.all') : t(requestStatusLabelKey(value))
                }
                selected={statusFilter === value}
                onPress={() => setStatusFilter(value)}
                testID={`family-status-${value}`}
              />
            ))}
          </ScrollView>

          {filterMembers.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}>
              <Chip
                label={t('family.filters.allMembers')}
                selected={memberFilterId === null}
                onPress={() => setMemberFilterId(null)}
                testID="family-member-filter-all"
              />
              {filterMembers.map((member) => (
                <Chip
                  key={member.id}
                  label={member.name}
                  selected={memberFilterId === member.id}
                  onPress={() => setMemberFilterId(member.id)}
                  testID={`family-member-filter-${member.id}`}
                />
              ))}
            </ScrollView>
          ) : null}

          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RequestCard
                request={item}
                onPress={() => openRequest(item.id)}
                testID={`family-request-${item.id}`}
              />
            )}
            ItemSeparatorComponent={ListItemSeparator}
            contentContainerStyle={styles.listContent}
            refreshControl={refreshControl}
            ListEmptyComponent={
              filtering ? (
                <EmptyState
                  icon="search-outline"
                  title={t('family.emptySearchTitle')}
                  message={t('family.emptySearchMessage')}
                />
              ) : (
                <EmptyState
                  icon="people-outline"
                  title={t('family.requestsEmptyTitle')}
                  message={t('family.requestsEmptyMessage')}
                  actionLabel={t('family.addRequest')}
                  onAction={openNewRequest}
                />
              )
            }
          />
        </>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MemberRow
              member={item}
              onPress={() => openMember(item.id)}
              testID={`family-member-${item.id}`}
            />
          )}
          ItemSeparatorComponent={ListItemSeparator}
          contentContainerStyle={styles.listContent}
          refreshControl={refreshControl}
          ListEmptyComponent={
            <EmptyState
              icon="person-outline"
              title={t('family.membersEmptyTitle')}
              message={t('family.membersEmptyMessage')}
              actionLabel={t('family.addMember')}
              onAction={openNewMember}
            />
          }
        />
      )}

      <Fab
        onPress={segment === 'requests' ? openNewRequest : openNewMember}
        accessibilityLabel={
          segment === 'requests' ? t('family.addRequestA11y') : t('family.addMemberA11y')
        }
        testID="add-family-fab"
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
  searchRow: {
    paddingHorizontal: Spacing.lg,
  },
  chipRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 96,
    paddingTop: 0,
    flexGrow: 1,
  },
  separator: {
    height: Spacing.sm,
  },
});
