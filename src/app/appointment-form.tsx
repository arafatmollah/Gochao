import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { confirmDestructive } from '@/components/confirm';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import {
  useAppointmentForm,
  APPOINTMENT_DOCTOR_MAX_LENGTH,
  APPOINTMENT_NOTES_MAX_LENGTH,
  APPOINTMENT_PLACE_MAX_LENGTH,
  APPOINTMENT_TITLE_MAX_LENGTH,
} from '@/features/health/hooks/use-appointment-form';
import { translateValidationCode } from '@/i18n/errors';
import { useTranslation } from '@/i18n';
import { Colors, IconSize, Spacing } from '@/theme/tokens';

export default function AppointmentFormScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const appointmentId =
    typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const form = useAppointmentForm(appointmentId);

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
      title: t('health.visitForm.deleteTitle'),
      message: t('health.visitForm.deleteMessage', { title: form.title }),
      confirmLabel: t('health.visitForm.delete'),
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
          title: form.isEdit ? t('health.visitForm.editTitle') : t('health.visitForm.newTitle'),
        }}
      />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('health.visitForm.loading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('health.visitForm.loadErrorTitle')}
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
                label={t('health.visitForm.titleLabel')}
                value={form.title}
                onChangeText={form.setTitle}
                placeholder={t('health.visitForm.titlePlaceholder')}
                error={form.titleError ? translateValidationCode(form.titleError, t) : null}
                autoFocus={!form.isEdit}
                maxLength={APPOINTMENT_TITLE_MAX_LENGTH}
                returnKeyType="next"
                testID="visit-title-input"
              />

              <TextField
                label={t('health.visitForm.doctorLabel')}
                value={form.doctor}
                onChangeText={form.setDoctor}
                placeholder={t('health.visitForm.doctorPlaceholder')}
                error={form.doctorError ? translateValidationCode(form.doctorError, t) : null}
                optional
                maxLength={APPOINTMENT_DOCTOR_MAX_LENGTH}
                testID="visit-doctor-input"
              />

              <TextField
                label={t('health.visitForm.placeLabel')}
                value={form.place}
                onChangeText={form.setPlace}
                placeholder={t('health.visitForm.placePlaceholder')}
                error={form.placeError ? translateValidationCode(form.placeError, t) : null}
                optional
                maxLength={APPOINTMENT_PLACE_MAX_LENGTH}
                testID="visit-place-input"
              />

              <View style={styles.row}>
                <View style={styles.half}>
                  <TextField
                    label={t('health.visitForm.dateLabel')}
                    value={form.date}
                    onChangeText={form.setDate}
                    placeholder={t('health.visitForm.datePlaceholder')}
                    error={form.dateError ? translateValidationCode(form.dateError, t) : null}
                    maxLength={10}
                    testID="visit-date-input"
                  />
                </View>
                <View style={styles.half}>
                  <TextField
                    label={t('health.visitForm.timeLabel')}
                    value={form.time}
                    onChangeText={form.setTime}
                    placeholder={t('health.visitForm.timePlaceholder')}
                    error={form.timeError ? translateValidationCode(form.timeError, t) : null}
                    optional
                    maxLength={5}
                    testID="visit-time-input"
                  />
                </View>
              </View>

              <TextField
                label={t('health.visitForm.notesLabel')}
                value={form.notes}
                onChangeText={form.setNotes}
                placeholder={t('health.visitForm.notesPlaceholder')}
                error={form.notesError ? translateValidationCode(form.notesError, t) : null}
                optional
                multiline
                maxLength={APPOINTMENT_NOTES_MAX_LENGTH}
                testID="visit-notes-input"
              />

              <View style={styles.actions}>
                <Button
                  label={form.isEdit ? t('health.visitForm.save') : t('health.visitForm.add')}
                  onPress={handleSave}
                  loading={form.saving}
                  disabled={form.deleting}
                  fullWidth
                  testID="save-visit-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={busy}
                  fullWidth
                  testID="cancel-visit-button"
                />
              </View>

              {form.isEdit ? (
                <View style={styles.destructiveZone}>
                  <Button
                    label={t('health.visitForm.delete')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={form.deleting}
                    disabled={form.saving}
                    fullWidth
                    icon={<Ionicons name="trash-outline" size={IconSize.sm} color={Colors.danger} />}
                    testID="delete-visit-button"
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

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  half: {
    flex: 1,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  destructiveZone: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.lg,
    marginTop: Spacing.sm,
  },
});
