import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { confirmDestructive } from '@/components/confirm';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useTaskForm } from '@/features/tasks/hooks/use-task-form';
import { formatIsoDateDisplay, formatIsoDateRelative } from '@/i18n/format';
import { translateValidationCode } from '@/i18n/errors';
import { useTranslation } from '@/i18n';
import { IconSize, Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { ThemeColors } from '@/theme/tokens';
import { TASK_DESCRIPTION_MAX_LENGTH, TASK_PRIORITIES, type TaskPriority } from '@/types/task';
import { addDaysIsoDate, parseIsoDate, toIsoDate, todayIsoDate } from '@/utils/dates';

export default function TaskFormScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const taskId = typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const form = useTaskForm(taskId);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(() => new Date());

  function quickDueOptions(): { label: string; value: string | null }[] {
    const today = todayIsoDate();
    return [
      { label: t('dates.today'), value: today },
      { label: t('dates.tomorrow'), value: addDaysIsoDate(today, 1) },
      { label: t('taskForm.dueInWeek'), value: addDaysIsoDate(today, 7) },
      { label: t('taskForm.dueNoDate'), value: null },
    ];
  }

  function openDatePicker() {
    setPickerValue((form.dueAt ? parseIsoDate(form.dueAt) : null) ?? new Date());
    setShowDatePicker(true);
  }

  function onDatePicked(event: DateTimePickerEvent, date?: Date) {
    setShowDatePicker(false);
    if (event.type === 'set' && date) {
      form.setDueAt(toIsoDate(date));
    }
  }

  function goBack() {
    // Deep links (web URLs, Android intents) can open the form with no
    // history entry, in which case back() would strand the user here.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }

  async function handleSave() {
    const saved = await form.submit();
    if (saved) {
      goBack();
    }
  }

  async function handleDelete() {
    const confirmed = await confirmDestructive({
      title: t('taskForm.deleteTitle'),
      message: t('taskForm.deleteMessage', { title: form.title }),
      confirmLabel: t('taskForm.deleteConfirm'),
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
        options={{ title: form.isEdit ? t('taskForm.editTitle') : t('taskForm.newTitle') }}
      />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('taskForm.loading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('taskForm.loadErrorTitle')}
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
                label={t('taskForm.titleLabel')}
                value={form.title}
                onChangeText={form.setTitle}
                placeholder={t('taskForm.titlePlaceholder')}
                error={form.titleError ? translateValidationCode(form.titleError, t) : null}
                autoFocus={!form.isEdit}
                maxLength={140}
                returnKeyType="next"
                testID="task-title-input"
              />

              <TextField
                label={t('taskForm.descriptionLabel')}
                value={form.description}
                onChangeText={form.setDescription}
                placeholder={t('taskForm.descriptionPlaceholder')}
                error={
                  form.descriptionError ? translateValidationCode(form.descriptionError, t) : null
                }
                optional
                multiline
                maxLength={TASK_DESCRIPTION_MAX_LENGTH}
                testID="task-description-input"
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('taskForm.priorityLabel')}
                </AppText>
                <View style={styles.optionRow}>
                  {TASK_PRIORITIES.map((priority: TaskPriority) => (
                    <Chip
                      key={priority}
                      label={t(`priority.${priority}`)}
                      selected={form.priority === priority}
                      onPress={() => form.setPriority(priority)}
                      testID={`priority-${priority}`}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('taskForm.dueLabel')}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {form.dueAt
                    ? t('taskForm.dueDisplay', {
                        date: formatIsoDateDisplay(form.dueAt, t),
                        relative: formatIsoDateRelative(form.dueAt, todayIsoDate(), t),
                      })
                    : t('taskForm.dueNone')}
                </AppText>
                <View style={styles.optionRow}>
                  {quickDueOptions().map((option) => (
                    <Chip
                      key={option.label}
                      label={option.label}
                      selected={form.dueAt === option.value}
                      onPress={() => form.setDueAt(option.value)}
                    />
                  ))}
                </View>
                {/* @react-native-community/datetimepicker has no web
                    implementation, so the button is native-only. */}
                {Platform.OS !== 'web' ? (
                  <Button
                    label={t('taskForm.pickDate')}
                    variant="secondary"
                    size="sm"
                    onPress={openDatePicker}
                    icon={<Ionicons name="calendar-outline" size={IconSize.sm} color={colors.text} />}
                    testID="pick-date-button"
                  />
                ) : null}
              </View>

              <View style={styles.actions}>
                <Button
                  label={form.isEdit ? t('taskForm.save') : t('taskForm.add')}
                  onPress={handleSave}
                  loading={form.saving}
                  disabled={form.deleting}
                  fullWidth
                  testID="save-task-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={busy}
                  fullWidth
                  testID="cancel-task-button"
                />
              </View>

              {form.isEdit ? (
                <View style={styles.destructiveZone}>
                  <Button
                    label={t('taskForm.deleteTask')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={form.deleting}
                    disabled={form.saving}
                    fullWidth
                    icon={<Ionicons name="trash-outline" size={IconSize.sm} color={colors.danger} />}
                    testID="delete-task-button"
                  />
                </View>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {showDatePicker ? (
          <DateTimePicker
            value={pickerValue}
            mode="date"
            display="default"
            onChange={onDatePicked}
          />
        ) : null}
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
  fieldGroup: {
    gap: Spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
