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
import { NoteCard } from '@/features/notes/components/note-card';
import { useNotes } from '@/features/notes/hooks/use-notes';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';

export default function NotesScreen() {
  const { t } = useTranslation();
  const {
    notes,
    categories,
    search,
    setSearch,
    categoryId,
    setCategoryId,
    loading,
    refreshing,
    error,
    notice,
    clearNotice,
    refresh,
    togglePin,
  } = useNotes();

  function openNewNote() {
    router.push('/note-form');
  }

  function openNote(id: string) {
    router.push({ pathname: '/note-form', params: { id } });
  }

  const filtering = search.trim().length > 0 || categoryId !== null;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('notes.title')} testID="notes-header" />

      {notice ? (
        <View style={styles.bannerWrapper}>
          <Banner message={notice} onDismiss={clearNotice} />
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder={t('notes.searchPlaceholder')}
          testID="notes-search"
        />
      </View>

      {categories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}>
          <Chip
            label={t('notes.allCategories')}
            selected={categoryId === null}
            onPress={() => setCategoryId(null)}
            testID="notes-category-all"
          />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              selected={categoryId === category.id}
              onPress={() => setCategoryId(category.id)}
              testID={`notes-category-${category.id}`}
            />
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <LoadingState label={t('notes.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => openNote(item.id)}
              onTogglePin={() => void togglePin(item)}
              testID={`note-card-${item.id}`}
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
                title={t('notes.emptySearchTitle')}
                message={t('notes.emptySearchMessage')}
              />
            ) : (
              <EmptyState
                icon="document-text-outline"
                title={t('notes.emptyTitle')}
                message={t('notes.emptyMessage')}
                actionLabel={t('notes.addNote')}
                onAction={openNewNote}
              />
            )
          }
        />
      )}

      <Fab
        onPress={openNewNote}
        accessibilityLabel={t('notes.addNoteA11y')}
        testID="add-note-fab"
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
  searchRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  categoryRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
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
