import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { BILL_CATEGORY_ICONS } from '@/features/bills/meta';
import { useBillPay } from '@/features/bills/hooks/use-bill-pay';
import { translateValidationCode } from '@/i18n/errors';
import { formatIsoDateDisplay, formatIsoDateRelative, formatMoney } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { Colors, IconSize, Spacing } from '@/theme/tokens';
import { isValidIsoDate, parseIsoDate, toIsoDate, todayIsoDate, addDaysIsoDate } from '@/utils/dates';
import { normalizeDigitInput } from '@/utils/money';

export default function BillPayScreen() {
  const { t, locale } = useTranslation();
  const params = useLocalSearchParams<{ occurrenceId?: string }>();
  const occurrenceId =
    typeof params.occurrenceId === 'string' && params.occurrenceId.length > 0
      ? params.occurrenceId
      : undefined;
  const pay = useBillPay(occurrenceId);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(() => new Date());

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/bills');
  }

  function openDatePicker() {
    setPickerValue((pay.paidOn ? parseIsoDate(pay.paidOn) : null) ?? new Date());
    setShowDatePicker(true);
  }

  function onDatePicked(event: DateTimePickerEvent, date?: Date) {
    setShowDatePicker(false);
    if (event.type === 'set' && date) {
      pay.setPaidOn(toIsoDate(date));
    }
  }

  async function handleSave() {
    const recorded = await pay.submit();
    if (recorded) {
      goBack();
    }
  }

  const today = todayIsoDate();
  const yesterday = addDaysIsoDate(today, -1);
  const paidOnPreview = isValidIsoDate(pay.paidOn) ? pay.paidOn : null;
  const occurrence = pay.occurrence;

  return (
    <>
      <Stack.Screen options={{ title: t('bills.pay.title') }} />
      <Screen edges={['bottom']}>
        {pay.loadState === 'loading' ? (
          <LoadingState label={t('bills.loading')} />
        ) : pay.loadState === 'error' || !occurrence ? (
          <ErrorState
            title={t('bills.pay.loadErrorTitle')}
            message={pay.loadError ?? t('errors.generic')}
            onRetry={pay.retryLoad}
          />
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag">
              {/* Severity rule 13: this only records a payment locally. */}
              <Banner tone="info" message={t('bills.pay.disclaimer')} />

              {pay.formError ? <Banner message={pay.formError} /> : null}

              <Card style={styles.contextCard}>
                <View style={styles.contextRow}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name={BILL_CATEGORY_ICONS[occurrence.billCategory]}
                      size={IconSize.md}
                      color={Colors.primary}
                    />
                  </View>
                  <View style={styles.contextBody}>
                    <AppText variant="bodyStrong" numberOfLines={2}>
                      {occurrence.billName}
                    </AppText>
                    <AppText variant="caption" color="textSecondary">
                      {`${formatIsoDateDisplay(occurrence.dueOn, t)} (${formatIsoDateRelative(occurrence.dueOn, today, t)})`}
                    </AppText>
                  </View>
                </View>
                <AppText variant="caption" color="textSecondary">
                  {t('bills.due.expected', {
                    amount: formatMoney(occurrence.expectedAmountMinor, locale),
                  })}
                </AppText>
              </Card>

              <TextField
                label={t('bills.pay.amountLabel')}
                value={pay.amountText}
                onChangeText={pay.setAmountText}
                error={pay.amountError ? translateValidationCode(pay.amountError, t) : null}
                keyboardType="decimal-pad"
                accessibilityHint={t('bills.pay.amountHint')}
                testID="pay-amount-input"
              />
              <AppText variant="caption" color="textMuted">
                {t('bills.pay.amountHint')}
              </AppText>

              <View style={styles.fieldGroup}>
                <TextField
                  label={t('bills.pay.paidOnLabel')}
                  value={pay.paidOn}
                  onChangeText={(value) => pay.setPaidOn(normalizeDigitInput(value))}
                  placeholder="2026-10-11"
                  error={pay.paidOnError ? translateValidationCode(pay.paidOnError, t) : null}
                  testID="pay-date-input"
                />
                <AppText variant="caption" color="textMuted">
                  {paidOnPreview
                    ? `${formatIsoDateDisplay(paidOnPreview, t)} (${formatIsoDateRelative(paidOnPreview, today, t)})`
                    : ''}
                </AppText>
                <View style={styles.optionRow}>
                  <Chip
                    label={t('dates.today')}
                    selected={pay.paidOn === today}
                    onPress={() => pay.setPaidOn(today)}
                  />
                  <Chip
                    label={t('dates.yesterday')}
                    selected={pay.paidOn === yesterday}
                    onPress={() => pay.setPaidOn(yesterday)}
                  />
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
                    testID="pay-pick-date-button"
                  />
                ) : null}
              </View>

              {pay.accounts.length > 0 ? (
                <View style={styles.fieldGroup}>
                  <AppText variant="bodyStrong">{t('bills.pay.accountLabel')}</AppText>
                  <View style={styles.optionRow}>
                    {pay.accounts.map((account) => (
                      <Chip
                        key={account.id}
                        label={account.name}
                        selected={pay.accountId === account.id}
                        onPress={() => pay.setAccountChoice(account.id)}
                        testID={`pay-account-chip-${account.id}`}
                      />
                    ))}
                    <Chip
                      label={t('bills.pay.accountNone')}
                      selected={pay.accountId === null}
                      onPress={() => pay.setAccountChoice(null)}
                      testID="pay-account-none-chip"
                    />
                  </View>
                  <AppText variant="caption" color="textMuted">
                    {pay.accountId === null
                      ? t('bills.pay.accountNoExpenseHint')
                      : t('bills.pay.accountHint')}
                  </AppText>
                </View>
              ) : null}

              <View style={styles.actions}>
                <Button
                  label={t('bills.pay.submit')}
                  onPress={handleSave}
                  loading={pay.saving}
                  fullWidth
                  testID="record-payment-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={pay.saving}
                  fullWidth
                  testID="cancel-payment-button"
                />
              </View>
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
  contextCard: {
    gap: Spacing.sm,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextBody: {
    flex: 1,
    gap: Spacing.xs,
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
});
