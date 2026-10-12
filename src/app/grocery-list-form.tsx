import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import {
  useGroceryListForm,
  GROCERY_LIST_NAME_MAX_LENGTH,
  GROCERY_NOTES_MAX_LENGTH,
} from '@/features/grocery/hooks/use-grocery-list-form';
import { translateValidationCode } from '@/i18n/errors';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';

export default function GroceryListFormScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const listId = typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const form = useGroceryListForm(listId);

  function goBack() {
    // Deep links (web URLs, Android intents) can open the form with no
    // history entry, in which case back() would strand the user here.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/grocery');
  }

  async function handleSave() {
    const saved = await form.submit();
    if (saved) {
      goBack();
    }
  }

  const busy = form.saving || form.deleting;

  return (
    <>
      <Stack.Screen
        options={{ title: form.isEdit ? t('grocery.listForm.editTitle') : t('grocery.listForm.newTitle') }}
      />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('grocery.listForm.loading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('grocery.listForm.loadErrorTitle')}
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

              <TextField
                label={t('grocery.listForm.nameLabel')}
                value={form.name}
                onChangeText={form.setName}
                placeholder={t('grocery.listForm.namePlaceholder')}
                error={form.nameError ? translateValidationCode(form.nameError, t) : null}
                autoFocus={!form.isEdit}
                maxLength={GROCERY_LIST_NAME_MAX_LENGTH}
                returnKeyType="next"
                testID="grocery-list-name-input"
              />

              <TextField
                label={t('grocery.listForm.notesLabel')}
                value={form.notes}
                onChangeText={form.setNotes}
                placeholder={t('grocery.listForm.notesPlaceholder')}
                error={form.notesError ? translateValidationCode(form.notesError, t) : null}
                optional
                multiline
                maxLength={GROCERY_NOTES_MAX_LENGTH}
                testID="grocery-list-notes-input"
              />

              <Button
                label={form.isEdit ? t('grocery.listForm.save') : t('grocery.listForm.add')}
                onPress={handleSave}
                loading={form.saving}
                disabled={form.deleting}
                fullWidth
                testID="save-grocery-list-button"
              />
              <Button
                label={t('common.cancel')}
                variant="secondary"
                onPress={goBack}
                disabled={busy}
                fullWidth
                testID="cancel-grocery-list-button"
              />
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
});
