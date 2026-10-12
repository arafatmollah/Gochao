import { router, Stack, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { confirmDestructive } from '@/components/confirm';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useMemberForm } from '@/features/family/hooks/use-member-form';
import { relationshipLabelKey } from '@/features/family/meta';
import { useTranslation } from '@/i18n';
import { formatIsoDateDisplay } from '@/i18n/format';
import { Spacing } from '@/theme/tokens';
import { FAMILY_RELATIONSHIPS, type FamilyRelationship } from '@/types/family';

export default function MemberFormScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const memberId = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;
  const form = useMemberForm(memberId);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/family');
  }

  async function handleSave() {
    const saved = await form.save();
    if (saved) {
      goBack();
    }
  }

  async function handleDelete() {
    const confirmed = await confirmDestructive({
      title: t('family.memberForm.deleteTitle'),
      message: t('family.memberForm.deleteMessage', { name: form.name.trim() }),
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

  return (
    <>
      <Stack.Screen
        options={{
          title:
            form.mode === 'edit' ? t('family.memberForm.editTitle') : t('family.memberForm.newTitle'),
        }}
      />
      <Screen edges={['bottom']}>
        {form.loading ? (
          <LoadingState />
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {form.loadError ? <Banner message={form.loadError} onDismiss={() => goBack()} /> : null}
              {form.notice ? (
                <Banner message={form.notice} onDismiss={form.clearNotice} testID="member-form-notice" />
              ) : null}

              <TextField
                label={t('family.memberForm.nameLabel')}
                value={form.name}
                onChangeText={form.setName}
                placeholder={t('family.memberForm.namePlaceholder')}
                maxLength={80}
                testID="member-name-input"
              />

              <View style={styles.section}>
                <AppText variant="label" color="textSecondary">
                  {t('family.memberForm.relationshipLabel')}
                </AppText>
                <View style={styles.chipRow}>
                  {FAMILY_RELATIONSHIPS.map((value: FamilyRelationship) => (
                    <Chip
                      key={value}
                      label={t(relationshipLabelKey(value))}
                      selected={form.relationship === value}
                      onPress={() => form.setRelationship(value)}
                      testID={`member-relationship-${value}`}
                    />
                  ))}
                </View>
              </View>

              <TextField
                label={t('family.memberForm.contactLabel')}
                value={form.contact}
                onChangeText={form.setContact}
                placeholder={t('family.memberForm.contactPlaceholder')}
                maxLength={200}
                testID="member-contact-input"
              />

              <TextField
                label={t('family.memberForm.notesLabel')}
                value={form.notes}
                onChangeText={form.setNotes}
                placeholder={t('family.memberForm.notesPlaceholder')}
                multiline
                maxLength={1000}
                testID="member-notes-input"
              />

              {form.mode === 'edit' ? (
                <View style={styles.section}>
                  <Chip
                    label={
                      form.isArchived
                        ? t('family.memberForm.restoreMember')
                        : t('family.memberForm.archiveMember')
                    }
                    selected={form.isArchived}
                    onPress={form.toggleArchived}
                    testID="member-archive-toggle"
                  />
                  <AppText variant="caption" color="textMuted">
                    {form.isArchived
                      ? t('family.memberForm.archivedHint')
                      : t('family.memberForm.archiveHint')}
                  </AppText>
                </View>
              ) : null}

              {form.mode === 'edit' && form.createdAt && form.updatedAt ? (
                <View style={styles.dates}>
                  <AppText variant="caption" color="textMuted">
                    {t('family.memberForm.createdOn', {
                      date: formatIsoDateDisplay(form.createdAt.slice(0, 10), t),
                    })}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {t('family.memberForm.updatedOn', {
                      date: formatIsoDateDisplay(form.updatedAt.slice(0, 10), t),
                    })}
                  </AppText>
                </View>
              ) : null}

              <Button
                label={form.mode === 'edit' ? t('family.memberForm.save') : t('family.memberForm.add')}
                onPress={() => void handleSave()}
                loading={form.saving}
                fullWidth
                testID="member-save-button"
              />

              {form.mode === 'edit' ? (
                <Button
                  label={t('family.memberForm.delete')}
                  variant="danger"
                  onPress={() => void handleDelete()}
                  disabled={form.saving}
                  fullWidth
                  testID="member-delete-button"
                />
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
