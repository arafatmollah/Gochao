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
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useTransferForm } from '@/features/finance/hooks/use-transfer-form';
import { formatIsoDateDisplay, formatIsoDateRelative } from '@/i18n/format';
import { translateValidationCode } from '@/i18n/errors';
import { useTranslation } from '@/i18n';
import { IconSize, Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import {
  addDaysIsoDate,
  isValidIsoDate,
  parseIsoDate,
  toIsoDate,
  todayIsoDate,
} from '@/utils/dates';
import { normalizeDigitInput } from '@/utils/money';

export default function FinanceTransferScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const transferId =
    typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const form = useTransferForm(transferId);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(() => new Date());

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/finance-transactions');
  }

  function openDatePicker() {
    setPickerValue((form.occurredOn ? parseIsoDate(form.occurredOn) : null) ?? new Date());
    setShowDatePicker(true);
  }

  function onDatePicked(event: DateTimePickerEvent, date?: Date) {
    setShowDatePicker(false);
    if (event.type === 'set' && date) {
      form.setOccurredOn(toIsoDate(date));
    }
  }

  async function handleSave() {
    const saved = await form.submit();
    if (saved) {
      goBack();
    }
  }

  async function handleDelete() {
    const confirmed = await confirmDestructive({
      title: t('finance.transfer.deleteTitle'),
      message: t('finance.transfer.deleteMessage', {
        amount: form.amountText.trim(),
        date: form.occurredOn,
      }),
      confirmLabel: t('finance.transfer.deleteConfirm'),
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

  const today = todayIsoDate();
  const yesterday = addDaysIsoDate(today, -1);
  const datePreview = isValidIsoDate(form.occurredOn) ? form.occurredOn : null;

  return (
    <>
      <Stack.Screen
        options={{ title: form.isEdit ? t('finance.transfer.editTitle') : t('finance.transfer.title') }}
      />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('finance.transfer.loading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('finance.transfer.loadErrorTitle')}
            message={form.loadError ?? t('errors.generic')}
            onRetry={form.retryLoad}
          />
        ) : form.accounts.length < 2 ? (
          <EmptyState
            icon="swap-horizontal-outline"
            title={t('finance.transfer.noAccountsTitle')}
            message={t('finance.transfer.noAccountsMessage')}
            actionLabel={t('finance.transfer.addAccount')}
            onAction={() => router.push('/account-form')}
            testID="transfer-no-accounts"
          />
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag">
              <Banner tone="info" message={t('finance.transfer.hint')} />
              {form.formError ? <Banner message={form.formError} /> : null}

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('finance.transfer.fromLabel')}
                </AppText>
                <View style={styles.optionRow}>
                  {form.accounts.map((account) => (
                    <Chip
                      key={account.id}
                      label={account.name}
                      selected={form.fromAccountId === account.id}
                      onPress={() => form.setFromAccountId(account.id)}
                      testID={`transfer-from-${account.id}`}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('finance.transfer.toLabel')}
                </AppText>
                <View style={styles.optionRow}>
                  {form.accounts.map((account) => (
                    <Chip
                      key={account.id}
                      label={account.name}
                      selected={form.toAccountId === account.id}
                      onPress={() => form.setToAccountId(account.id)}
                      testID={`transfer-to-${account.id}`}
                    />
                  ))}
                </View>
                {form.accountsError ? (
                  <AppText variant="caption" color="danger">
                    {translateValidationCode(form.accountsError, t)}
                  </AppText>
                ) : null}
              </View>

              <TextField
                label={t('finance.transfer.amountLabel')}
                value={form.amountText}
                onChangeText={(value) => form.setAmountText(normalizeDigitInput(value))}
                placeholder={t('finance.transfer.amountPlaceholder')}
                error={form.amountError ? translateValidationCode(form.amountError, t) : null}
                keyboardType="decimal-pad"
                testID="transfer-amount-input"
              />

              <View style={styles.fieldGroup}>
                <TextField
                  label={t('finance.transfer.dateLabel')}
                  value={form.occurredOn}
                  onChangeText={form.setOccurredOn}
                  placeholder="2026-10-11"
                  error={form.occurredOnError ? translateValidationCode(form.occurredOnError, t) : null}
                  testID="transfer-date-input"
                />
                <AppText variant="caption" color="textMuted">
                  {datePreview
                    ? `${formatIsoDateDisplay(datePreview, t)} (${formatIsoDateRelative(datePreview, today, t)})`
                    : ''}
                </AppText>
                <View style={styles.optionRow}>
                  <Chip
                    label={t('dates.today')}
                    selected={form.occurredOn === today}
                    onPress={() => form.setOccurredOn(today)}
                  />
                  <Chip
                    label={t('dates.yesterday')}
                    selected={form.occurredOn === yesterday}
                    onPress={() => form.setOccurredOn(yesterday)}
                  />
                </View>
                {Platform.OS !== 'web' ? (
                  <Button
                    label={t('finance.transfer.pickDate')}
                    variant="secondary"
                    size="sm"
                    onPress={openDatePicker}
                    icon={<Ionicons name="calendar-outline" size={IconSize.sm} color={colors.text} />}
                    testID="transfer-pick-date-button"
                  />
                ) : null}
              </View>

              <TextField
                label={t('finance.transfer.notesLabel')}
                value={form.notes}
                onChangeText={form.setNotes}
                placeholder={t('finance.transfer.notesPlaceholder')}
                error={form.notesError ? translateValidationCode(form.notesError, t) : null}
                multiline
                optional
                testID="transfer-notes-input"
              />

              <View style={styles.actions}>
                <Button
                  label={form.isEdit ? t('finance.transfer.save') : t('finance.transfer.submit')}
                  onPress={handleSave}
                  loading={form.saving}
                  fullWidth
                  testID="save-transfer-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={form.saving}
                  fullWidth
                  testID="cancel-transfer-button"
                />
              </View>

              {form.isEdit ? (
                <View style={styles.dangerZone}>
                  <Button
                    label={t('finance.transfer.deleteTransfer')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={form.deleting}
                    fullWidth
                    testID="delete-transfer-button"
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
  dangerZone: {
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
});
