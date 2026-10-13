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

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { confirmDestructive } from '@/components/confirm';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import {
  useMedicineForm,
  MEDICINE_DOSAGE_MAX_LENGTH,
  MEDICINE_NAME_MAX_LENGTH,
  MEDICINE_NOTES_MAX_LENGTH,
  MEDICINE_PRESCRIBER_MAX_LENGTH,
  MEDICINE_STRENGTH_MAX_LENGTH,
} from '@/features/health/hooks/use-medicine-form';
import { translateValidationCode } from '@/i18n/errors';
import { useTranslation } from '@/i18n';
import { IconSize, Radius, Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { ThemeColors } from '@/theme/tokens';
import {
  MEDICINE_FREQUENCIES,
  WEEKDAYS,
  type MedicineFrequency,
  type Weekday,
} from '@/types/health';

export default function MedicineFormScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const medicineId =
    typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const form = useMedicineForm(medicineId);

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
      title: t('health.medicineForm.deleteTitle'),
      message: t('health.medicineForm.deleteMessage', { name: form.name }),
      confirmLabel: t('health.medicineForm.delete'),
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

  async function handleArchive() {
    const archived = await form.toggleArchived();
    if (archived) {
      goBack();
    }
  }

  const busy = form.saving || form.deleting || form.archiving;

  return (
    <>
      <Stack.Screen
        options={{
          title: form.isEdit ? t('health.medicineForm.editTitle') : t('health.medicineForm.newTitle'),
        }}
      />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('health.medicineForm.loading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('health.medicineForm.loadErrorTitle')}
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
                label={t('health.medicineForm.nameLabel')}
                value={form.name}
                onChangeText={form.setName}
                placeholder={t('health.medicineForm.namePlaceholder')}
                error={form.nameError ? translateValidationCode(form.nameError, t) : null}
                autoFocus={!form.isEdit}
                maxLength={MEDICINE_NAME_MAX_LENGTH}
                returnKeyType="next"
                testID="medicine-name-input"
              />

              <TextField
                label={t('health.medicineForm.strengthLabel')}
                value={form.strength}
                onChangeText={form.setStrength}
                placeholder={t('health.medicineForm.strengthPlaceholder')}
                error={
                  form.strengthError ? translateValidationCode(form.strengthError, t) : null
                }
                optional
                maxLength={MEDICINE_STRENGTH_MAX_LENGTH}
                testID="medicine-strength-input"
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('health.medicineForm.frequencyLabel')}
                </AppText>
                <View style={styles.optionRow}>
                  {MEDICINE_FREQUENCIES.map((frequency: MedicineFrequency) => (
                    <Chip
                      key={frequency}
                      label={t(`health.frequencies.${frequency}`)}
                      selected={form.frequency === frequency}
                      onPress={() => form.setFrequency(frequency)}
                      testID={`medicine-frequency-${frequency}`}
                    />
                  ))}
                </View>
              </View>

              <TextField
                label={t('health.medicineForm.dosageLabel')}
                value={form.dosage}
                onChangeText={form.setDosage}
                placeholder={t('health.medicineForm.dosagePlaceholder')}
                error={form.dosageError ? translateValidationCode(form.dosageError, t) : null}
                optional
                multiline
                maxLength={MEDICINE_DOSAGE_MAX_LENGTH}
                testID="medicine-dosage-input"
              />

              <View style={styles.row}>
                <View style={styles.half}>
                  <TextField
                    label={t('health.medicineForm.startLabel')}
                    value={form.startDate}
                    onChangeText={form.setStartDate}
                    placeholder={t('health.medicineForm.startPlaceholder')}
                    error={form.dateError ? translateValidationCode(form.dateError, t) : null}
                    optional
                    maxLength={10}
                    testID="medicine-start-input"
                  />
                </View>
                <View style={styles.half}>
                  <TextField
                    label={t('health.medicineForm.endLabel')}
                    value={form.endDate}
                    onChangeText={form.setEndDate}
                    placeholder={t('health.medicineForm.endPlaceholder')}
                    error={form.dateError ? translateValidationCode(form.dateError, t) : null}
                    optional
                    maxLength={10}
                    testID="medicine-end-input"
                  />
                </View>
              </View>

              <TextField
                label={t('health.medicineForm.prescriberLabel')}
                value={form.prescriber}
                onChangeText={form.setPrescriber}
                placeholder={t('health.medicineForm.prescriberPlaceholder')}
                error={
                  form.prescriberError ? translateValidationCode(form.prescriberError, t) : null
                }
                optional
                maxLength={MEDICINE_PRESCRIBER_MAX_LENGTH}
                testID="medicine-prescriber-input"
              />

              <TextField
                label={t('health.medicineForm.notesLabel')}
                value={form.notes}
                onChangeText={form.setNotes}
                placeholder={t('health.medicineForm.notesPlaceholder')}
                error={form.notesError ? translateValidationCode(form.notesError, t) : null}
                optional
                multiline
                maxLength={MEDICINE_NOTES_MAX_LENGTH}
                testID="medicine-notes-input"
              />

              {form.frequency !== 'as_needed' ? (
                <View style={styles.fieldGroup}>
                  <AppText variant="label" color="textSecondary">
                    {t('health.medicineForm.schedulesLabel')}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {t('health.medicineForm.schedulesHint')}
                  </AppText>
                  {form.schedulesError ? (
                    <Banner message={translateValidationCode(form.schedulesError, t)} />
                  ) : null}
                  {form.schedules.map((draft) => (
                    <View key={draft.key} style={styles.scheduleCard}>
                      <View style={styles.scheduleRow}>
                        <View style={styles.timeField}>
                          <TextField
                            label={t('health.medicineForm.timePlaceholder')}
                            value={draft.time}
                            onChangeText={(value) => form.setScheduleTime(draft.key, value)}
                            placeholder={t('health.medicineForm.timePlaceholder')}
                            maxLength={5}
                            testID={`medicine-time-${draft.key}-input`}
                          />
                        </View>
                        {form.schedules.length > 1 ? (
                          <Button
                            label={t('health.medicineForm.removeTime')}
                            variant="secondary"
                            size="sm"
                            onPress={() => form.removeSchedule(draft.key)}
                            testID={`medicine-remove-time-${draft.key}`}
                          />
                        ) : null}
                      </View>
                      <AppText variant="caption" color="textMuted">
                        {t('health.medicineForm.daysLabel')}
                      </AppText>
                      <View style={styles.optionRow}>
                        <Chip
                          label={t('health.medicineForm.everyDay')}
                          selected={draft.weekdays.length === WEEKDAYS.length}
                          onPress={() => form.setScheduleEveryDay(draft.key)}
                          testID={`medicine-everyday-${draft.key}`}
                        />
                        {WEEKDAYS.map((weekday: Weekday) => (
                          <Chip
                            key={weekday}
                            label={t(`health.weekdays.${weekday}`)}
                            selected={draft.weekdays.includes(weekday)}
                            onPress={() => form.toggleScheduleWeekday(draft.key, weekday)}
                            testID={`medicine-day-${draft.key}-${weekday}`}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                  <Button
                    label={t('health.medicineForm.addTime')}
                    variant="secondary"
                    size="sm"
                    onPress={form.addSchedule}
                    icon={<Ionicons name="add-outline" size={IconSize.sm} color={colors.text} />}
                    testID="medicine-add-time-button"
                  />
                </View>
              ) : null}

              <View style={styles.actions}>
                <Button
                  label={form.isEdit ? t('health.medicineForm.save') : t('health.medicineForm.add')}
                  onPress={handleSave}
                  loading={form.saving}
                  disabled={form.deleting || form.archiving}
                  fullWidth
                  testID="save-medicine-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={busy}
                  fullWidth
                  testID="cancel-medicine-button"
                />
              </View>

              {form.isEdit ? (
                <View style={styles.destructiveZone}>
                  <Button
                    label={
                      form.isArchived
                        ? t('health.medicineForm.restore')
                        : t('health.medicineForm.archive')
                    }
                    variant="secondary"
                    onPress={handleArchive}
                    loading={form.archiving}
                    disabled={form.saving || form.deleting}
                    fullWidth
                    icon={
                      <Ionicons
                        name={form.isArchived ? 'refresh-outline' : 'archive-outline'}
                        size={IconSize.sm}
                        color={colors.text}
                      />
                    }
                    testID="archive-medicine-button"
                  />
                  <Button
                    label={t('health.medicineForm.delete')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={form.deleting}
                    disabled={form.saving || form.archiving}
                    fullWidth
                    icon={<Ionicons name="trash-outline" size={IconSize.sm} color={colors.danger} />}
                    testID="delete-medicine-button"
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
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  half: {
    flex: 1,
  },
  fieldGroup: {
    gap: Spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  scheduleCard: {
    gap: Spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  timeField: {
    flex: 1,
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
    gap: Spacing.sm,
  },
});
