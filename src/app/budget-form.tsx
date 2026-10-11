import { router, Stack, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { confirmDestructive } from '@/components/confirm';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useBudgetForm } from '@/features/finance/hooks/use-budget-form';
import { categoryDisplayName } from '@/features/finance/meta';
import { useTranslation } from '@/i18n';
import { translateValidationCode } from '@/i18n/errors';
import { Spacing } from '@/theme/tokens';
import { normalizeDigitInput } from '@/utils/money';

export default function BudgetFormScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const budgetId = typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const form = useBudgetForm(budgetId);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/finance-budgets');
  }

  async function handleSave() {
    const saved = await form.submit();
    if (saved) {
      goBack();
    }
  }

  async function handleDelete() {
    const category = form.lockedCategory;
    const displayName = category
      ? categoryDisplayName(category, t)
      : t('finance.budgetForm.categoryLabel');
    const confirmed = await confirmDestructive({
      title: t('finance.budgetForm.deleteTitle'),
      message: t('finance.budgetForm.deleteMessage', { category: displayName }),
      confirmLabel: t('finance.budgetForm.deleteConfirm'),
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
        options={{
          title: form.isEdit ? t('finance.budgetForm.editTitle') : t('finance.budgetForm.newTitle'),
        }}
      />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('finance.budgetForm.loading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('finance.budgetForm.loadErrorTitle')}
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

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('finance.budgetForm.categoryLabel')}
                </AppText>
                {form.isEdit && form.lockedCategory ? (
                  <Card accessibilityLabel={categoryDisplayName(form.lockedCategory, t)}>
                    <AppText variant="bodyStrong">
                      {categoryDisplayName(form.lockedCategory, t)}
                    </AppText>
                  </Card>
                ) : form.availableCategories.length === 0 ? (
                  <AppText variant="caption" color="textMuted">
                    {t('finance.budgets.allBudgeted')}
                  </AppText>
                ) : (
                  <View style={styles.optionRow}>
                    {form.availableCategories.map((category) => (
                      <Chip
                        key={category.id}
                        label={categoryDisplayName(category, t)}
                        selected={form.categoryId === category.id}
                        onPress={() => form.chooseCategory(category.id)}
                        testID={`budget-category-${category.id}`}
                      />
                    ))}
                  </View>
                )}
              </View>

              <TextField
                label={t('finance.budgetForm.amountLabel')}
                value={form.amountText}
                onChangeText={(value) => form.setAmountText(normalizeDigitInput(value))}
                placeholder={t('finance.budgetForm.amountPlaceholder')}
                error={form.amountError ? translateValidationCode(form.amountError, t) : null}
                keyboardType="decimal-pad"
                testID="budget-amount-input"
              />

              <View style={styles.actions}>
                <Button
                  label={form.isEdit ? t('finance.budgetForm.save') : t('finance.budgetForm.add')}
                  onPress={handleSave}
                  loading={form.saving}
                  disabled={!form.isEdit && form.availableCategories.length === 0}
                  fullWidth
                  testID="save-budget-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={form.saving}
                  fullWidth
                  testID="cancel-budget-button"
                />
              </View>

              {form.isEdit ? (
                <View style={styles.dangerZone}>
                  <Button
                    label={t('finance.budgetForm.deleteBudget')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={form.deleting}
                    fullWidth
                    testID="delete-budget-button"
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
