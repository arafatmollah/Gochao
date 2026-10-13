import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { confirmDestructive } from '@/components/confirm';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useCategoryForm } from '@/features/finance/hooks/use-category-form';
import { categoryDisplayName } from '@/features/finance/meta';
import { useTranslation } from '@/i18n';
import { translateValidationCode } from '@/i18n/errors';
import { IconSize, Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

export default function CategoryFormScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const categoryId = typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const form = useCategoryForm(categoryId);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/finance-categories');
  }

  async function handleSave() {
    const saved = await form.submit();
    if (saved) {
      goBack();
    }
  }

  async function handleToggleArchive() {
    const done = await form.toggleArchive();
    if (done) {
      goBack();
    }
  }

  async function handleDelete() {
    const displayName = form.isBuiltin
      ? categoryDisplayName({ id: categoryId ?? '', name: form.name, isBuiltin: true }, t)
      : form.name.trim();
    const confirmed = await confirmDestructive({
      title: t('finance.categories.deleteTitle'),
      message: t('finance.categories.deleteMessage', { name: displayName }),
      confirmLabel: t('finance.categories.deleteConfirm'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) {
      return;
    }
    const removed = await form.remove();
    if (removed) {
      goBack();
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: form.isEdit ? t('finance.categories.editTitle') : t('finance.categories.newTitle'),
        }}
      />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('finance.categories.loadingOne')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('finance.categories.loadErrorTitle')}
            message={form.loadError ?? t('errors.generic')}
            onRetry={form.retryLoad}
          />
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag">
              {form.formError ? <Banner message={form.formError} /> : null}

              {form.isEdit && form.isBuiltin ? (
                <View style={styles.fieldGroup}>
                  <AppText variant="label" color="textSecondary">
                    {t('finance.categories.nameLabel')}
                  </AppText>
                  <Card
                    accessibilityLabel={categoryDisplayName(
                      { id: categoryId ?? '', name: form.name, isBuiltin: true },
                      t,
                    )}>
                    <View style={styles.lockedRow}>
                      <AppText variant="bodyStrong">
                        {categoryDisplayName({ id: categoryId ?? '', name: form.name, isBuiltin: true }, t)}
                      </AppText>
                      <Ionicons name="lock-closed-outline" size={IconSize.sm} color={colors.textMuted} />
                    </View>
                  </Card>
                  <AppText variant="caption" color="textMuted">
                    {t('finance.categories.builtinLocked')}
                  </AppText>
                </View>
              ) : (
                <TextField
                  label={t('finance.categories.nameLabel')}
                  value={form.name}
                  onChangeText={form.setName}
                  placeholder={t('finance.categories.namePlaceholder')}
                  error={form.nameError ? translateValidationCode(form.nameError, t) : null}
                  testID="category-name-input"
                />
              )}

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('finance.categories.kindLabel')}
                </AppText>
                {form.isEdit ? (
                  <Card accessibilityLabel={t(`finance.kind.${form.kind}`)}>
                    <AppText variant="bodyStrong">{t(`finance.kind.${form.kind}`)}</AppText>
                  </Card>
                ) : (
                  <View style={styles.optionRow}>
                    {(['income', 'expense'] as const).map((kind) => (
                      <Chip
                        key={kind}
                        label={t(`finance.kind.${kind}`)}
                        selected={form.kind === kind}
                        onPress={() => form.setKind(kind)}
                        testID={`category-kind-${kind}`}
                      />
                    ))}
                  </View>
                )}
                <AppText variant="caption" color="textMuted">
                  {t('finance.categories.kindHint')}
                </AppText>
              </View>

              <View style={styles.actions}>
                <Button
                  label={form.isEdit ? t('finance.categories.save') : t('finance.categories.add')}
                  onPress={handleSave}
                  loading={form.saving}
                  fullWidth
                  testID="save-category-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={form.saving}
                  fullWidth
                  testID="cancel-category-button"
                />
              </View>

              {form.isEdit ? (
                <View style={styles.dangerZone}>
                  <Button
                    label={
                      form.isArchived
                        ? t('finance.categories.restore')
                        : t('finance.categories.archive')
                    }
                    variant="secondary"
                    onPress={handleToggleArchive}
                    loading={form.archiving}
                    fullWidth
                    testID="toggle-archive-category-button"
                  />
                  {!form.isBuiltin ? (
                    <Button
                      label={t('finance.categories.deleteCategory')}
                      variant="danger"
                      onPress={handleDelete}
                      loading={form.deleting}
                      fullWidth
                      testID="delete-category-button"
                    />
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  fieldGroup: {
    gap: Spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  dangerZone: {
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
});
