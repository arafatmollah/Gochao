import { router, Stack, useLocalSearchParams } from 'expo-router';
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
import { useAccountForm } from '@/features/finance/hooks/use-account-form';
import { translateValidationCode } from '@/i18n/errors';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';
import { ACCOUNT_TYPES } from '@/types/finance';
import { normalizeDigitInput } from '@/utils/money';

export default function AccountFormScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const accountId =
    typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const form = useAccountForm(accountId);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/finance-accounts');
  }

  async function handleSave() {
    const saved = await form.submit();
    if (saved) {
      goBack();
    }
  }

  async function handleToggleArchive() {
    const done = await form.toggleArchive();
    if (done) {
      goBack();
    }
  }

  async function handleDelete() {
    const confirmed = await confirmDestructive({
      title: t('finance.accountForm.deleteTitle'),
      message: t('finance.accountForm.deleteMessage', { name: form.name.trim() }),
      confirmLabel: t('finance.accountForm.deleteConfirm'),
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

  return (
    <>
      <Stack.Screen
        options={{ title: form.isEdit ? t('finance.accountForm.editTitle') : t('finance.accountForm.newTitle') }}
      />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('finance.accountForm.loading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('finance.accountForm.loadErrorTitle')}
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
                label={t('finance.accountForm.nameLabel')}
                value={form.name}
                onChangeText={form.setName}
                placeholder={t('finance.accountForm.namePlaceholder')}
                error={form.nameError ? translateValidationCode(form.nameError, t) : null}
                testID="account-name-input"
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('finance.accountForm.typeLabel')}
                </AppText>
                <View style={styles.optionRow}>
                  {ACCOUNT_TYPES.map((value) => (
                    <Chip
                      key={value}
                      label={t(`finance.accountTypes.${value}`)}
                      selected={form.type === value}
                      onPress={() => form.setType(value)}
                      testID={`account-type-${value}`}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <TextField
                  label={t('finance.accountForm.openingLabel')}
                  value={form.openingText}
                  onChangeText={(value) => form.setOpeningText(normalizeDigitInput(value))}
                  placeholder={t('finance.accountForm.openingPlaceholder')}
                  error={form.openingError ? translateValidationCode(form.openingError, t) : null}
                  keyboardType="decimal-pad"
                  accessibilityHint={t('finance.accountForm.openingHint')}
                  testID="account-opening-input"
                />
                <AppText variant="caption" color="textMuted">
                  {t('finance.accountForm.openingHint')}
                </AppText>
              </View>

              <View style={styles.actions}>
                <Button
                  label={form.isEdit ? t('finance.accountForm.save') : t('finance.accountForm.add')}
                  onPress={handleSave}
                  loading={form.saving}
                  fullWidth
                  testID="save-account-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={form.saving}
                  fullWidth
                  testID="cancel-account-button"
                />
              </View>

              {form.isEdit ? (
                <View style={styles.dangerZone}>
                  <AppText variant="caption" color="textMuted">
                    {t('finance.accountForm.archiveHint')}
                  </AppText>
                  <Button
                    label={
                      form.isArchived
                        ? t('finance.accountForm.restore')
                        : t('finance.accountForm.archive')
                    }
                    variant="secondary"
                    onPress={handleToggleArchive}
                    loading={form.archiving}
                    fullWidth
                    testID="toggle-archive-account-button"
                  />
                  <Button
                    label={t('finance.accountForm.deleteAccount')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={form.deleting}
                    fullWidth
                    testID="delete-account-button"
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
