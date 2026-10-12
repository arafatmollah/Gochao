import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { confirmDestructive } from '@/components/confirm';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useRequestForm } from '@/features/family/hooks/use-request-form';
import { requestCategoryLabelKey, requestStatusLabelKey } from '@/features/family/meta';
import { useTranslation } from '@/i18n';
import { formatIsoDateDisplay, formatIsoDateRelative } from '@/i18n/format';
import { Spacing } from '@/theme/tokens';
import {
  FAMILY_REQUEST_CATEGORIES,
  FAMILY_REQUEST_STATUSES,
  type FamilyRequestCategory,
  type FamilyRequestStatus,
} from '@/types/family';
import { isValidIsoDate, addDaysIsoDate, parseIsoDate, toIsoDate, todayIsoDate } from '@/utils/dates';
import { normalizeDigitInput } from '@/utils/money';

export default function RequestFormScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const requestId = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;
  const form = useRequestForm(requestId);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(() => new Date());

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/family');
  }

  function quickDeadlineOptions(): { label: string; value: string | null; testId: string }[] {
    const today = todayIsoDate();
    return [
      { label: t('dates.today'), value: today, testId: 'today' },
      { label: t('dates.tomorrow'), value: addDaysIsoDate(today, 1), testId: 'tomorrow' },
      { label: t('taskForm.dueInWeek'), value: addDaysIsoDate(today, 7), testId: 'week' },
      { label: t('taskForm.dueNoDate'), value: null, testId: 'none' },
    ];
  }

  function openDatePicker() {
    setPickerValue((form.deadline ? parseIsoDate(form.deadline) : null) ?? new Date());
    setShowDatePicker(true);
  }

  function onDatePicked(event: DateTimePickerEvent, date?: Date) {
    setShowDatePicker(false);
    if (event.type === 'set' && date) {
      form.setDeadline(toIsoDate(date));
    }
  }

  async function handleSave() {
    const saved = await form.save();
    if (saved) {
      goBack();
    }
  }

  async function handleDelete() {
    const confirmed = await confirmDestructive({
      title: t('family.requestForm.deleteTitle'),
      message: t('family.requestForm.deleteMessage', { title: form.title.trim() }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) {
      return;
    }
    const deleted = await form.remove();
    if (deleted) {
      goBack();
    }
  }

  const deadlinePreview = isValidIsoDate(form.deadline ?? '') ? form.deadline : null;

  return (
    <>
      <Stack.Screen
        options={{
          title:
            form.mode === 'edit'
              ? t('family.requestForm.editTitle')
              : t('family.requestForm.newTitle'),
        }}
      />
      <Screen edges={['bottom']}>
        {form.loading ? (
          <LoadingState />
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled">
              {form.loadError ? (
                <Banner message={form.loadError} onDismiss={() => goBack()} />
              ) : null}
              {form.notice ? (
                <Banner message={form.notice} onDismiss={form.clearNotice} testID="request-form-notice" />
              ) : null}

              <TextField
                label={t('family.requestForm.titleLabel')}
                value={form.title}
                onChangeText={form.setTitle}
                placeholder={t('family.requestForm.titlePlaceholder')}
                maxLength={140}
                testID="request-title-input"
              />

              <TextField
                label={t('family.requestForm.detailsLabel')}
                value={form.details}
                onChangeText={form.setDetails}
                placeholder={t('family.requestForm.detailsPlaceholder')}
                multiline
                maxLength={2000}
                testID="request-details-input"
              />

              <View style={styles.section}>
                <AppText variant="label" color="textSecondary">
                  {t('family.requestForm.memberLabel')}
                </AppText>
                <View style={styles.chipRow}>
                  <Chip
                    label={t('family.requestForm.noMember')}
                    selected={form.memberId === null}
                    onPress={() => form.setMemberId(null)}
                    testID="request-member-none"
                  />
                  {form.members.map((member) => (
                    <Chip
                      key={member.id}
                      label={
                        member.isArchived
                          ? `${member.name} (${t('family.archived')})`
                          : member.name
                      }
                      selected={form.memberId === member.id}
                      onPress={() => form.setMemberId(member.id)}
                      testID={`request-member-${member.id}`}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <AppText variant="label" color="textSecondary">
                  {t('family.requestForm.categoryLabel')}
                </AppText>
                <View style={styles.chipRow}>
                  {FAMILY_REQUEST_CATEGORIES.map((value: FamilyRequestCategory) => (
                    <Chip
                      key={value}
                      label={t(requestCategoryLabelKey(value))}
                      selected={form.category === value}
                      onPress={() => form.setCategory(value)}
                      testID={`request-category-${value}`}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <AppText variant="label" color="textSecondary">
                  {t('family.requestForm.priorityLabel')}
                </AppText>
                <View style={styles.chipRow}>
                  {(['low', 'medium', 'high'] as const).map((value) => (
                    <Chip
                      key={value}
                      label={t(`priority.${value}`)}
                      selected={form.priority === value}
                      onPress={() => form.setPriority(value)}
                      testID={`request-priority-${value}`}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <AppText variant="label" color="textSecondary">
                  {t('family.requestForm.deadlineLabel')}
                </AppText>
                {deadlinePreview ? (
                  <AppText variant="caption" color="textSecondary">
                    {t('family.requestForm.deadlineDisplay', {
                      date: formatIsoDateDisplay(deadlinePreview, t),
                      relative: formatIsoDateRelative(deadlinePreview, todayIsoDate(), t),
                    })}
                  </AppText>
                ) : (
                  <AppText variant="caption" color="textMuted">
                    {t('family.requestForm.noDeadline')}
                  </AppText>
                )}
                <View style={styles.chipRow}>
                  {quickDeadlineOptions().map((option) => (
                    <Chip
                      key={option.testId}
                      label={option.label}
                      selected={form.deadline === option.value}
                      onPress={() => form.setDeadline(option.value)}
                      testID={`request-quick-deadline-${option.testId}`}
                    />
                  ))}
                </View>
                {/* @react-native-community/datetimepicker has no web
                    implementation, so the button is native-only. */}
                {Platform.OS !== 'web' ? (
                  <View style={styles.chipRow}>
                    <Button
                      label={
                        deadlinePreview
                          ? t('family.requestForm.changeDeadline')
                          : t('family.requestForm.pickDeadline')
                      }
                      variant="secondary"
                      size="sm"
                      onPress={openDatePicker}
                      testID="request-pick-deadline"
                    />
                  </View>
                ) : null}
              </View>

              <TextField
                label={t('family.requestForm.costLabel')}
                value={form.costText}
                onChangeText={(value) => form.setCostText(normalizeDigitInput(value))}
                placeholder={t('family.requestForm.costPlaceholder')}
                keyboardType="decimal-pad"
                testID="request-cost-input"
              />

              {form.mode === 'edit' ? (
                <View style={styles.section}>
                  <AppText variant="label" color="textSecondary">
                    {t('family.requestForm.statusLabel')}
                  </AppText>
                  <View style={styles.chipRow}>
                    {FAMILY_REQUEST_STATUSES.map((value: FamilyRequestStatus) => (
                      <Chip
                        key={value}
                        label={t(requestStatusLabelKey(value))}
                        selected={form.status === value}
                        onPress={() => void form.changeStatus(value)}
                        testID={`request-status-${value}`}
                      />
                    ))}
                  </View>
                  {form.taskId ? (
                    <AppText variant="caption" color="textSecondary">
                      {t('family.requestForm.taskLinked')}
                    </AppText>
                  ) : (
                    <Button
                      label={t('family.requestForm.createTask')}
                      variant="secondary"
                      onPress={() => void form.generateTask()}
                      testID="request-create-task-button"
                    />
                  )}
                </View>
              ) : null}

              {form.mode === 'edit' && form.createdAt && form.updatedAt ? (
                <View style={styles.dates}>
                  <AppText variant="caption" color="textMuted">
                    {t('family.requestForm.createdOn', {
                      date: formatIsoDateDisplay(form.createdAt.slice(0, 10), t),
                    })}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {t('family.requestForm.updatedOn', {
                      date: formatIsoDateDisplay(form.updatedAt.slice(0, 10), t),
                    })}
                  </AppText>
                </View>
              ) : null}

              <Button
                label={form.mode === 'edit' ? t('family.requestForm.save') : t('family.requestForm.add')}
                onPress={() => void handleSave()}
                loading={form.saving}
                fullWidth
                testID="request-save-button"
              />

              {form.mode === 'edit' ? (
                <Button
                  label={t('family.requestForm.delete')}
                  variant="danger"
                  onPress={() => void handleDelete()}
                  disabled={form.saving}
                  fullWidth
                  testID="request-delete-button"
                />
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Screen>
      {showDatePicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          onChange={onDatePicked}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  dates: {
    gap: 2,
  },
});
