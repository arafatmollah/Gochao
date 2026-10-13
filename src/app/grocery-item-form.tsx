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
  useGroceryItemForm,
  GROCERY_ITEM_NAME_MAX_LENGTH,
  GROCERY_NOTES_MAX_LENGTH,
  GROCERY_UNIT_MAX_LENGTH,
} from '@/features/grocery/hooks/use-grocery-item-form';
import { translateValidationCode } from '@/i18n/errors';
import { useTranslation } from '@/i18n';
import { IconSize, Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { ThemeColors } from '@/theme/tokens';

export default function GroceryItemFormScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string; listId?: string }>();
  const itemId =
    typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const listId =
    typeof params.listId === 'string' && params.listId.length > 0 ? params.listId : null;
  const form = useGroceryItemForm(listId, itemId);

  function goBack() {
    // Deep links (web URLs, Android intents) can open the form with no
    // history entry, in which case back() would strand the user here.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/grocery');
  }

  async function handleSave() {
    const saved = await form.submit();
    if (saved) {
      goBack();
    }
  }

  async function handleDelete() {
    const confirmed = await confirmDestructive({
      title: t('grocery.itemForm.deleteTitle'),
      message: t('grocery.itemForm.deleteMessage', { name: form.name }),
      confirmLabel: t('grocery.itemForm.delete'),
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
        options={{ title: form.isEdit ? t('grocery.itemForm.editTitle') : t('grocery.itemForm.newTitle') }}
      />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('grocery.itemForm.loading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('grocery.itemForm.loadErrorTitle')}
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
                label={t('grocery.itemForm.nameLabel')}
                value={form.name}
                onChangeText={form.setName}
                placeholder={t('grocery.itemForm.namePlaceholder')}
                error={form.nameError ? translateValidationCode(form.nameError, t) : null}
                autoFocus={!form.isEdit}
                maxLength={GROCERY_ITEM_NAME_MAX_LENGTH}
                returnKeyType="next"
                testID="grocery-item-name-input"
              />

              <View style={styles.row}>
                <View style={styles.quantityField}>
                  <TextField
                    label={t('grocery.itemForm.quantityLabel')}
                    value={form.quantityText}
                    onChangeText={form.setQuantityText}
                    placeholder={t('grocery.itemForm.quantityPlaceholder')}
                    error={
                      form.quantityError ? translateValidationCode(form.quantityError, t) : null
                    }
                    keyboardType="decimal-pad"
                    testID="grocery-item-quantity-input"
                  />
                </View>
                <View style={styles.unitField}>
                  <TextField
                    label={t('grocery.itemForm.unitLabel')}
                    value={form.unit}
                    onChangeText={form.setUnit}
                    placeholder={t('grocery.itemForm.unitPlaceholder')}
                    error={form.unitError ? translateValidationCode(form.unitError, t) : null}
                    optional
                    maxLength={GROCERY_UNIT_MAX_LENGTH}
                    testID="grocery-item-unit-input"
                  />
                </View>
              </View>

              <TextField
                label={t('grocery.itemForm.estimatedLabel')}
                value={form.estimatedText}
                onChangeText={form.setEstimatedText}
                placeholder={t('grocery.itemForm.estimatedPlaceholder')}
                error={
                  form.estimatedError ? translateValidationCode(form.estimatedError, t) : null
                }
                optional
                keyboardType="decimal-pad"
                testID="grocery-item-estimated-input"
              />

              <TextField
                label={t('grocery.itemForm.actualLabel')}
                value={form.actualText}
                onChangeText={form.setActualText}
                placeholder={t('grocery.itemForm.actualPlaceholder')}
                error={form.actualError ? translateValidationCode(form.actualError, t) : null}
                optional
                keyboardType="decimal-pad"
                testID="grocery-item-actual-input"
              />

              {form.members.length > 0 ? (
                <View style={styles.fieldGroup}>
                  <AppText variant="label" color="textSecondary">
                    {t('grocery.itemForm.memberLabel')}
                  </AppText>
                  <View style={styles.optionRow}>
                    <Chip
                      label={t('grocery.itemForm.noMember')}
                      selected={form.assignedMemberId === null}
                      onPress={() => form.setAssignedMemberId(null)}
                      testID="grocery-member-none"
                    />
                    {form.members.map((member) => (
                      <Chip
                        key={member.id}
                        label={member.name}
                        selected={form.assignedMemberId === member.id}
                        onPress={() => form.setAssignedMemberId(member.id)}
                        testID={`grocery-member-${member.id}`}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <TextField
                label={t('grocery.itemForm.notesLabel')}
                value={form.notes}
                onChangeText={form.setNotes}
                placeholder={t('grocery.itemForm.notesPlaceholder')}
                error={form.notesError ? translateValidationCode(form.notesError, t) : null}
                optional
                multiline
                maxLength={GROCERY_NOTES_MAX_LENGTH}
                testID="grocery-item-notes-input"
              />

              <View style={styles.actions}>
                <Button
                  label={form.isEdit ? t('grocery.itemForm.save') : t('grocery.itemForm.add')}
                  onPress={handleSave}
                  loading={form.saving}
                  disabled={form.deleting}
                  fullWidth
                  testID="save-grocery-item-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={busy}
                  fullWidth
                  testID="cancel-grocery-item-button"
                />
              </View>

              {form.isEdit ? (
                <View style={styles.destructiveZone}>
                  <Button
                    label={t('grocery.itemForm.delete')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={form.deleting}
                    disabled={form.saving}
                    fullWidth
                    icon={<Ionicons name="trash-outline" size={IconSize.sm} color={colors.danger} />}
                    testID="delete-grocery-item-button"
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
  quantityField: {
    flex: 1,
  },
  unitField: {
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
