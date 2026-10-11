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
import { categoryDisplayName } from '@/features/finance/meta';
import { useTransactionForm } from '@/features/finance/hooks/use-transaction-form';
import { translateValidationCode } from '@/i18n/errors';
import { formatIsoDateDisplay, formatIsoDateRelative } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { Colors, IconSize, Spacing } from '@/theme/tokens';
import type { TransactionKind } from '@/types/finance';
import {
  addDaysIsoDate,
  isValidIsoDate,
  parseIsoDate,
  toIsoDate,
  todayIsoDate,
} from '@/utils/dates';
import { normalizeDigitInput } from '@/utils/money';

export default function TransactionFormScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const transactionId =
    typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const initialKind: TransactionKind = params.kind === 'income' ? 'income' : 'expense';
  const form = useTransactionForm(transactionId, initialKind);

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
      title: t('finance.transactionForm.deleteTitle'),
      message: t('finance.transactionForm.deleteMessage', {
        description: form.description.trim(),
      }),
      confirmLabel: t('finance.transactionForm.deleteConfirm'),
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

  const title = form.lockedByBill
    ? t('finance.transactionForm.editExpenseTitle')
    : form.isEdit
      ? form.kind === 'income'
        ? t('finance.transactionForm.editIncomeTitle')
        : t('finance.transactionForm.editExpenseTitle')
      : form.kind === 'income'
        ? t('finance.transactionForm.newIncomeTitle')
        : t('finance.transactionForm.newExpenseTitle');

  const today = todayIsoDate();
  const yesterday = addDaysIsoDate(today, -1);
  const datePreview = isValidIsoDate(form.occurredOn) ? form.occurredOn : null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('finance.transactionForm.loading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('finance.transactionForm.loadErrorTitle')}
            message={form.loadError ?? t('errors.generic')}
            onRetry={form.retryLoad}
          />
        ) : form.accounts.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title={t('finance.overview.noAccountsTitle')}
            message={t('finance.overview.noAccountsMessage')}
            actionLabel={t('finance.overview.addAccount')}
            onAction={() => router.push('/account-form')}
            testID="transaction-form-no-accounts"
          />
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag">
              {form.lockedByBill ? (
                <Banner tone="info" message={t('finance.transactionForm.billLinkedNote')} />
              ) : null}
              {form.formError ? <Banner message={form.formError} /> : null}

              <TextField
                label={t('finance.transactionForm.amountLabel')}
                value={form.amountText}
                onChangeText={(value) => form.setAmountText(normalizeDigitInput(value))}
                placeholder={t('finance.transactionForm.amountPlaceholder')}
                error={form.amountError ? translateValidationCode(form.amountError, t) : null}
                keyboardType="decimal-pad"
                testID="transaction-amount-input"
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('finance.transactionForm.accountLabel')}
                </AppText>
                <View style={styles.optionRow}>
                  {form.accounts.map((account) => (
                    <Chip
                      key={account.id}
                      label={account.name}
                      selected={form.accountId === account.id}
                      onPress={() => form.setAccountId(account.id)}
                      testID={`transaction-account-${account.id}`}
                    />
                  ))}
                </View>
                {form.accountError ? (
                  <AppText variant="caption" color="danger">
                    {translateValidationCode(form.accountError, t)}
                  </AppText>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('finance.transactionForm.categoryLabel')}
                </AppText>
                <View style={styles.optionRow}>
                  {form.categories.map((category) => (
                    <Chip
                      key={category.id}
                      label={categoryDisplayName(category, t)}
                      selected={form.categoryId === category.id}
                      onPress={() => form.setCategoryId(category.id)}
                      testID={`transaction-category-${category.id}`}
                    />
                  ))}
                </View>
                {form.categoryError ? (
                  <AppText variant="caption" color="danger">
                    {translateValidationCode(form.categoryError, t)}
                  </AppText>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <TextField
                  label={t('finance.transactionForm.dateLabel')}
                  value={form.occurredOn}
                  onChangeText={form.setOccurredOn}
                  placeholder="2026-10-11"
                  error={form.occurredOnError ? translateValidationCode(form.occurredOnError, t) : null}
                  testID="transaction-date-input"
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
                {/* @react-native-community/datetimepicker has no web
                    implementation, so the button is native-only. */}
                {Platform.OS !== 'web' ? (
                  <Button
                    label={t('finance.transactionForm.pickDate')}
                    variant="secondary"
                    size="sm"
                    onPress={openDatePicker}
                    icon={<Ionicons name="calendar-outline" size={IconSize.sm} color={Colors.text} />}
                    testID="transaction-pick-date-button"
                  />
                ) : null}
              </View>

              <TextField
                label={t('finance.transactionForm.descriptionLabel')}
                value={form.description}
                onChangeText={form.setDescription}
                placeholder={
                  form.kind === 'income'
                    ? t('finance.transactionForm.descriptionIncomePlaceholder')
                    : t('finance.transactionForm.descriptionExpensePlaceholder')
                }
                error={form.descriptionError ? translateValidationCode(form.descriptionError, t) : null}
                testID="transaction-description-input"
              />

              {form.kind === 'expense' ? (
                <View style={styles.fieldGroup}>
                  <TextField
                    label={t('finance.transactionForm.recipientLabel')}
                    value={form.recipient}
                    onChangeText={form.setRecipient}
                    placeholder={t('finance.transactionForm.recipientHint')}
                    error={form.recipientError ? translateValidationCode(form.recipientError, t) : null}
                    testID="transaction-recipient-input"
                  />
                  <AppText variant="caption" color="textMuted">
                    {t('finance.transactionForm.recipientHint')}
                  </AppText>
                </View>
              ) : null}

              <TextField
                label={t('finance.transactionForm.notesLabel')}
                value={form.notes}
                onChangeText={form.setNotes}
                placeholder={t('finance.transactionForm.notesPlaceholder')}
                error={form.notesError ? translateValidationCode(form.notesError, t) : null}
                multiline
                optional
                testID="transaction-notes-input"
              />

              <View style={styles.actions}>
                <Button
                  label={
                    form.isEdit
                      ? t('finance.transactionForm.save')
                      : form.kind === 'income'
                        ? t('finance.transactionForm.addIncome')
                        : t('finance.transactionForm.addExpense')
                  }
                  onPress={handleSave}
                  loading={form.saving}
                  disabled={form.lockedByBill}
                  fullWidth
                  testID="save-transaction-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={form.saving}
                  fullWidth
                  testID="cancel-transaction-button"
                />
              </View>

              {form.isEdit && !form.lockedByBill ? (
                <View style={styles.dangerZone}>
                  <Button
                    label={t('finance.transactionForm.deleteTransaction')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={form.deleting}
                    fullWidth
                    testID="delete-transaction-button"
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
