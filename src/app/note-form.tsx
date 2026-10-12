import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { confirmDestructive } from '@/components/confirm';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useNoteForm } from '@/features/notes/hooks/use-note-form';
import { useTranslation } from '@/i18n';
import { formatIsoDateDisplay } from '@/i18n/format';
import { Colors, Radius, Spacing, Typography } from '@/theme/tokens';
import { NOTE_CONTENT_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from '@/types/note';

export default function NoteFormScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const noteId = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;
  const form = useNoteForm(noteId);

  async function handleSave() {
    const saved = await form.save();
    if (saved) {
      router.back();
    }
  }

  async function handleDelete() {
    const confirmed = await confirmDestructive({
      title: t('notes.form.deleteTitle'),
      message: t('notes.form.deleteMessage'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) {
      return;
    }
    const deleted = await form.remove();
    if (deleted) {
      router.back();
    }
  }

  const customSelectedTags = form.selectedTagNames.filter(
    (name) => !form.existingTags.some((tag) => tag.name.toLowerCase() === name.toLowerCase()),
  );

  return (
    <>
      <Stack.Screen
        options={{ title: form.mode === 'edit' ? t('notes.form.editTitle') : t('notes.form.newTitle') }}
      />
      <Screen edges={['bottom']}>
        {form.loading ? (
          <LoadingState />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {form.loadError ? <Banner message={form.loadError} onDismiss={() => router.back()} /> : null}
            {form.notice ? (
              <Banner message={form.notice} onDismiss={form.clearNotice} testID="note-form-notice" />
            ) : null}

            <TextField
              label={t('notes.form.titleLabel')}
              value={form.title}
              onChangeText={form.setTitle}
              placeholder={t('notes.form.titlePlaceholder')}
              maxLength={NOTE_TITLE_MAX_LENGTH}
              testID="note-title-input"
            />

            <TextField
              label={t('notes.form.contentLabel')}
              value={form.content}
              onChangeText={form.setContent}
              placeholder={t('notes.form.contentPlaceholder')}
              multiline
              maxLength={NOTE_CONTENT_MAX_LENGTH}
              testID="note-content-input"
            />

            <View style={styles.section}>
              <AppText variant="label" color="textSecondary">
                {t('notes.form.categoryLabel')}
              </AppText>
              <View style={styles.chipRow}>
                <Chip
                  label={t('notes.form.noCategory')}
                  selected={form.categoryId === null}
                  onPress={() => form.setCategoryId(null)}
                  testID="note-category-none"
                />
                {form.categories.map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    selected={form.categoryId === category.id}
                    onPress={() => form.setCategoryId(category.id)}
                    testID={`note-category-${category.id}`}
                  />
                ))}
              </View>
              <View style={styles.newCategoryRow}>
                <TextInput
                  value={form.newCategoryName}
                  onChangeText={form.setNewCategoryName}
                  placeholder={t('notes.form.newCategoryPlaceholder')}
                  placeholderTextColor={Colors.textMuted}
                  style={styles.newCategoryInput}
                  testID="note-new-category-input"
                  accessibilityLabel={t('notes.form.newCategoryPlaceholder')}
                />
                <Button
                  label={t('notes.form.addCategory')}
                  variant="secondary"
                  size="sm"
                  onPress={() => void form.addCategory()}
                  testID="note-add-category-button"
                />
              </View>
            </View>

            <View style={styles.section}>
              <AppText variant="label" color="textSecondary">
                {t('notes.form.tagsLabel')}
              </AppText>
              {form.existingTags.length > 0 ? (
                <View style={styles.chipRow}>
                  {form.existingTags.map((tag) => (
                    <Chip
                      key={tag.id}
                      label={tag.name}
                      selected={form.selectedTagNames.some(
                        (name) => name.toLowerCase() === tag.name.toLowerCase(),
                      )}
                      onPress={() => form.toggleTagName(tag.name)}
                      testID={`note-tag-${tag.id}`}
                    />
                  ))}
                </View>
              ) : null}
              {customSelectedTags.length > 0 ? (
                <View style={styles.chipRow}>
                  {customSelectedTags.map((name) => (
                    <Chip
                      key={name}
                      label={name}
                      selected
                      onPress={() => form.toggleTagName(name)}
                      testID={`note-tag-custom-${name}`}
                    />
                  ))}
                </View>
              ) : null}
              <TextInput
                value={form.newTagName}
                onChangeText={form.setNewTagName}
                placeholder={t('notes.form.tagInputPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                style={styles.tagInput}
                onSubmitEditing={form.addNewTag}
                returnKeyType="done"
                testID="note-tag-input"
                accessibilityLabel={t('notes.form.tagsLabel')}
              />
            </View>

            <View style={styles.section}>
              <Chip
                label={t('notes.form.pinLabel')}
                selected={form.pinned}
                onPress={() => form.setPinned(!form.pinned)}
                testID="note-pin-toggle"
              />
            </View>

            {form.mode === 'edit' && form.createdAt && form.updatedAt ? (
              <View style={styles.dates}>
                <AppText variant="caption" color="textMuted">
                  {t('notes.createdOn', { date: formatIsoDateDisplay(form.createdAt.slice(0, 10), t) })}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {t('notes.updatedOn', { date: formatIsoDateDisplay(form.updatedAt.slice(0, 10), t) })}
                </AppText>
              </View>
            ) : null}

            <Button
              label={t('notes.form.save')}
              onPress={() => void handleSave()}
              loading={form.saving}
              fullWidth
              testID="note-save-button"
            />

            {form.mode === 'edit' ? (
              <Button
                label={t('notes.form.delete')}
                variant="danger"
                onPress={() => void handleDelete()}
                disabled={form.saving}
                fullWidth
                testID="note-delete-button"
              />
            ) : null}
          </ScrollView>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 48,
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  newCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  newCategoryInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 40,
    ...Typography.body,
    color: Colors.text,
  },
  tagInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    ...Typography.body,
    color: Colors.text,
  },
  dates: {
    gap: 2,
  },
});
