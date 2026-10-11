import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { confirmDestructive } from '@/components/confirm';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useBillForm } from '@/features/bills/hooks/use-bill-form';
import { translateValidationCode } from '@/i18n/errors';
import { formatIsoDateDisplay, formatIsoDateRelative } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { Colors, IconSize, Spacing } from '@/theme/tokens';
import {
  BILL_CATEGORIES,
  BILL_NAME_MAX_LENGTH,
  BILL_NOTES_MAX_LENGTH,
  BILL_RECURRENCES,
  type BillCategory,
  type BillRecurrence,
} from '@/types/bill';
import { addDaysIsoDate, parseIsoDate, toIsoDate, todayIsoDate, isValidIsoDate } from '@/utils/dates';
import { normalizeDigitInput } from '@/utils/money';

export default function BillFormScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const billId = typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const form = useBillForm(billId);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(() => new Date());

  function quickDueOptions(): { label: string; value: string }[] {
    const today = todayIsoDate();
    return [
      { label: t('dates.today'), value: today },
      { label: t('dates.tomorrow'), value: addDaysIsoDate(today, 1) },
      { label: t('taskForm.dueInWeek'), value: addDaysIsoDate(today, 7) },
    ];
  }

  function openDatePicker() {
    setPickerValue((form.firstDueOn ? parseIsoDate(form.firstDueOn) : null) ?? new Date());
    setShowDatePicker(true);
  }

  function onDatePicked(event: DateTimePickerEvent, date?: Date) {
    setShowDatePicker(false);
    if (event.type === 'set' && date) {
      form.setFirstDueOn(toIsoDate(date));
    }
  }

  function goBack() {
    // Deep links (web URLs, Android intents) can open the form with no
    // history entry, in which case back() would strand the user here.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/bills');
  }

  async function handleSave() {
    const saved = await form.submit();
    if (saved) {
      goBack();
    }
  }

  async function handleDelete() {
    const confirmed = await confirmDestructive({
      title: t('bills.form.deleteTitle'),
      message: t('bills.form.deleteMessage', { name: form.name }),
      confirmLabel: t('bills.form.deleteConfirm'),
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
  const duePreview = isValidIsoDate(form.firstDueOn) ? form.firstDueOn : null;

  return (
    <>
      <Stack.Screen
        options={{ title: form.isEdit ? t('bills.form.editTitle') : t('bills.form.newTitle') }}
      />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('bills.form.loading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('bills.form.loadErrorTitle')}
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
                label={t('bills.form.nameLabel')}
                value={form.name}
                onChangeText={form.setName}
                placeholder={t('bills.form.namePlaceholder')}
                error={form.nameError ? translateValidationCode(form.nameError, t) : null}
                autoFocus={!form.isEdit}
                maxLength={BILL_NAME_MAX_LENGTH}
                returnKeyType="next"
                testID="bill-name-input"
              />

              <TextField
                label={t('bills.form.amountLabel')}
                value={form.amountText}
                onChangeText={form.setAmountText}
                placeholder={t('bills.form.amountPlaceholder')}
                error={form.amountError ? translateValidationCode(form.amountError, t) : null}
                keyboardType="decimal-pad"
                testID="bill-amount-input"
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('bills.form.categoryLabel')}
                </AppText>
                <View style={styles.optionRow}>
                  {BILL_CATEGORIES.map((category: BillCategory) => (
                    <Chip
                      key={category}
                      label={t(`bills.categories.${category}`)}
                      selected={form.category === category}
                      onPress={() => form.setCategory(category)}
                      testID={`bill-category-${category}`}
                    />
                  ))}
                </View>
              </View>

              {form.isEdit ? (
                <View style={styles.fieldGroup}>
                  <AppText variant="label" color="textSecondary">
                    {t('bills.form.recurrenceLabel')}
                  </AppText>
                  <AppText variant="body">
                    {`${t(`bills.recurrences.${form.recurrence}`)} · ${formatIsoDateDisplay(form.firstDueOn, t)}`}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {t('bills.form.immutableHint')}
                  </AppText>
                </View>
              ) : (
                <>
                  <View style={styles.fieldGroup}>
                    <AppText variant="label" color="textSecondary">
                      {t('bills.form.recurrenceLabel')}
                    </AppText>
                    <View style={styles.optionRow}>
                      {BILL_RECURRENCES.map((recurrence: BillRecurrence) => (
                        <Chip
                          key={recurrence}
                          label={t(`bills.recurrences.${recurrence}`)}
                          selected={form.recurrence === recurrence}
                          onPress={() => form.setRecurrence(recurrence)}
                          testID={`bill-recurrence-${recurrence}`}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <TextField
                      label={t('bills.form.firstDueLabel')}
                      value={form.firstDueOn}
                      onChangeText={(value) => form.setFirstDueOn(normalizeDigitInput(value))}
                      placeholder="2026-10-31"
                      error={
                        form.firstDueError ? translateValidationCode(form.firstDueError, t) : null
                      }
                      testID="bill-due-input"
                    />
                    <AppText variant="caption" color="textMuted">
                      {duePreview
                        ? `${formatIsoDateDisplay(duePreview, t)} (${formatIsoDateRelative(duePreview, todayIsoDate(), t)})`
                        : t('bills.form.firstDueHint')}
                    </AppText>
                    <View style={styles.optionRow}>
                      {quickDueOptions().map((option) => (
                        <Chip
                          key={option.label}
                          label={option.label}
                          selected={form.firstDueOn === option.value}
                          onPress={() => form.setFirstDueOn(option.value)}
                        />
                      ))}
                    </View>
                    {/* @react-native-community/datetimepicker has no web
                        implementation, so the button is native-only. */}
                    {Platform.OS !== 'web' ? (
                      <Button
                        label={t('bills.pay.pickDate')}
                        variant="secondary"
                        size="sm"
                        onPress={openDatePicker}
                        icon={<Ionicons name="calendar-outline" size={IconSize.sm} color={Colors.text} />}
                        testID="bill-pick-date-button"
                      />
                    ) : null}
                  </View>

                  {form.recurrence !== 'none' ? (
                    <TextField
                      label={t('bills.form.installmentsLabel')}
                      value={form.installmentText}
                      onChangeText={(value) => form.setInstallmentText(normalizeDigitInput(value))}
                      placeholder={t('bills.form.installmentsPlaceholder')}
                      error={
                        form.installmentError
                          ? translateValidationCode(form.installmentError, t)
                          : null
                      }
                      optional
                      keyboardType="number-pad"
                      accessibilityHint={t('bills.form.installmentsHint')}
                      testID="bill-installments-input"
                    />
                  ) : null}

                  <TextField
                    label={t('bills.form.reminderLabel')}
                    value={form.reminderText}
                    onChangeText={(value) => form.setReminderText(normalizeDigitInput(value))}
                    placeholder={t('bills.form.reminderPlaceholder')}
                    error={
                      form.reminderError ? translateValidationCode(form.reminderError, t) : null
                    }
                    optional
                    keyboardType="number-pad"
                    accessibilityHint={t('bills.form.reminderHint')}
                    testID="bill-reminder-input"
                  />
                  <AppText variant="caption" color="textMuted">
                    {t('bills.form.reminderHint')}
                  </AppText>
                </>
              )}

              <TextField
                label={t('bills.form.notesLabel')}
                value={form.notes}
                onChangeText={form.setNotes}
                placeholder={t('bills.form.notesPlaceholder')}
                error={form.notesError ? translateValidationCode(form.notesError, t) : null}
                optional
                multiline
                maxLength={BILL_NOTES_MAX_LENGTH}
                testID="bill-notes-input"
              />

              <View style={styles.actions}>
                <Button
                  label={form.isEdit ? t('bills.form.save') : t('bills.form.add')}
                  onPress={handleSave}
                  loading={form.saving}
                  disabled={form.deleting}
                  fullWidth
                  testID="save-bill-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={busy}
                  fullWidth
                  testID="cancel-bill-button"
                />
              </View>

              {form.isEdit ? (
                <View style={styles.destructiveZone}>
                  <Button
                    label={t('bills.form.deleteBill')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={form.deleting}
                    disabled={form.saving}
                    fullWidth
                    icon={<Ionicons name="trash-outline" size={IconSize.sm} color={Colors.danger} />}
                    testID="delete-bill-button"
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
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  destructiveZone: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.lg,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
});
