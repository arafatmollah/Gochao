import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useMemo } from 'react';

import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { confirmDestructive } from '@/components/confirm';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import {
  useHealthNoteForm,
  HEALTH_RECORD_CONTENT_MAX_LENGTH,
  HEALTH_RECORD_TITLE_MAX_LENGTH,
} from '@/features/health/hooks/use-health-note-form';
import { translateValidationCode } from '@/i18n/errors';
import { useTranslation } from '@/i18n';
import { IconSize, Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { ThemeColors } from '@/theme/tokens';

export default function HealthNoteFormScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const recordId =
    typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const form = useHealthNoteForm(recordId);

  function goBack() {
    // Deep links (web URLs, Android intents) can open the form with no
    // history entry, in which case back() would strand the user here.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/health');
  }

  async function handleSave() {
    const saved = await form.submit();
    if (saved) {
      goBack();
    }
  }

  async function handleDelete() {
    const confirmed = await confirmDestructive({
      title: t('health.noteForm.deleteTitle'),
      message: t('health.noteForm.deleteMessage', { title: form.title }),
      confirmLabel: t('health.noteForm.delete'),
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

  const busy = form.saving || form.deleting;

  return (
    <>
      <Stack.Screen
        options={{
          title: form.isEdit ? t('health.noteForm.editTitle') : t('health.noteForm.newTitle'),
        }}
      />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('health.noteForm.loading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('health.noteForm.loadErrorTitle')}
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
                label={t('health.noteForm.titleLabel')}
                value={form.title}
                onChangeText={form.setTitle}
                placeholder={t('health.noteForm.titlePlaceholder')}
                error={form.titleError ? translateValidationCode(form.titleError, t) : null}
                autoFocus={!form.isEdit}
                maxLength={HEALTH_RECORD_TITLE_MAX_LENGTH}
                returnKeyType="next"
                testID="health-note-title-input"
              />

              <TextField
                label={t('health.noteForm.contentLabel')}
                value={form.content}
                onChangeText={form.setContent}
                placeholder={t('health.noteForm.contentPlaceholder')}
                error={form.contentError ? translateValidationCode(form.contentError, t) : null}
                optional
                multiline
                maxLength={HEALTH_RECORD_CONTENT_MAX_LENGTH}
                testID="health-note-content-input"
              />

              <TextField
                label={t('health.noteForm.dateLabel')}
                value={form.recordedOn}
                onChangeText={form.setRecordedOn}
                placeholder={t('health.noteForm.datePlaceholder')}
                error={form.dateError ? translateValidationCode(form.dateError, t) : null}
                maxLength={10}
                testID="health-note-date-input"
              />

              <View style={styles.actions}>
                <Button
                  label={form.isEdit ? t('health.noteForm.save') : t('health.noteForm.add')}
                  onPress={handleSave}
                  loading={form.saving}
                  disabled={form.deleting}
                  fullWidth
                  testID="save-health-note-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={busy}
                  fullWidth
                  testID="cancel-health-note-button"
                />
              </View>

              {form.isEdit ? (
                <View style={styles.destructiveZone}>
                  <Button
                    label={t('health.noteForm.delete')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={form.deleting}
                    disabled={form.saving}
                    fullWidth
                    icon={<Ionicons name="trash-outline" size={IconSize.sm} color={colors.danger} />}
                    testID="delete-health-note-button"
                  />
                </View>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Screen>
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  destructiveZone: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: Spacing.lg,
    marginTop: Spacing.sm,
  },
});
