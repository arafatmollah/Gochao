import { router, Stack } from 'expo-router';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { CategoryRow } from '@/features/finance/components/category-row';
import { useCategories } from '@/features/finance/hooks/use-categories';
import { useTranslation } from '@/i18n';
import { Colors, Spacing } from '@/theme/tokens';
import type { CategoryWithUsage } from '@/types/finance';

export default function FinanceCategoriesScreen() {
  const { t } = useTranslation();
  const { income, expense, includeArchived, setIncludeArchived, loading, refreshing, error, refresh } =
    useCategories();

  const sections = [
    { key: 'income', title: t('finance.categories.incomeTitle'), data: income },
    { key: 'expense', title: t('finance.categories.expenseTitle'), data: expense },
  ].filter((section) => section.data.length > 0);

  function openCategory(category: CategoryWithUsage) {
    router.push({ pathname: '/category-form', params: { id: category.id } });
  }

  function openNewCategory() {
    router.push('/category-form');
  }

  return (
    <>
      <Stack.Screen options={{ title: t('finance.categories.title') }} />
      <Screen edges={['bottom']}>
        {loading ? (
          <LoadingState label={t('finance.categories.loading')} />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CategoryRow
                category={item}
                onPress={() => openCategory(item)}
                testID={`category-row-${item.id}`}
              />
            )}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <AppText variant="subheading">{section.title}</AppText>
              </View>
            )}
            ItemSeparatorComponent={ListSpacer}
            SectionSeparatorComponent={ListSpacer}
            ListHeaderComponent={
              <View style={styles.toolbar}>
                <Chip
                  label={
                    includeArchived
                      ? t('finance.categories.hideArchived')
                      : t('finance.categories.showArchived')
                  }
                  selected={includeArchived}
                  onPress={() => setIncludeArchived(!includeArchived)}
                  testID="categories-archived-toggle"
                />
              </View>
            }
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="pricetags-outline"
                title={t('finance.categories.emptyTitle')}
                message={t('finance.categories.emptyMessage')}
                actionLabel={t('finance.categories.add')}
                onAction={openNewCategory}
              />
            }
          />
        )}

        <Fab
          onPress={openNewCategory}
          accessibilityLabel={t('finance.categories.add')}
          testID="add-category-fab"
        />
      </Screen>
    </>
  );
}

function ListSpacer() {
  return <View style={styles.spacer} />;
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 96,
    flexGrow: 1,
  },
  sectionHeader: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  spacer: {
    height: Spacing.sm,
  },
});
