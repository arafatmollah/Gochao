import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import {
  useWatchlistForm,
  WATCH_NOTES_MAX_LENGTH,
  WATCH_TITLE_MAX_LENGTH,
  WATCH_URL_MAX_LENGTH,
} from '@/features/entertainment/hooks/use-watchlist-form';
import { translateValidationCode } from '@/i18n/errors';
import { useTranslation } from '@/i18n';
import { Colors, IconSize, Radius, Spacing } from '@/theme/tokens';
import {
  WATCH_KINDS,
  WATCH_RATING_MAX,
  WATCH_STATUSES,
  type WatchKind,
  type WatchStatus,
} from '@/types/entertainment';

export default function EntertainmentFormScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const itemId =
    typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const form = useWatchlistForm(itemId);

  function goBack() {
    // Deep links (web URLs, Android intents) can open the form with no
    // history entry, in which case back() would strand the user here.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/entertainment');
  }

  async function handleSave() {
    const saved = await form.submit();
    if (saved) {
      goBack();
    }
  }

  async function handleDelete() {
    const confirmed = await confirmDestructive({
      title: t('entertainment.form.deleteTitle'),
      message: t('entertainment.form.deleteMessage', { name: form.title }),
      confirmLabel: t('entertainment.form.delete'),
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
        options={{
          title: form.isEdit ? t('entertainment.form.editTitle') : t('entertainment.form.newTitle'),
        }}
      />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('entertainment.form.loading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('entertainment.form.loadErrorTitle')}
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
                label={t('entertainment.form.titleLabel')}
                value={form.title}
                onChangeText={form.setTitle}
                placeholder={t('entertainment.form.titlePlaceholder')}
                error={form.titleError ? translateValidationCode(form.titleError, t) : null}
                autoFocus={!form.isEdit}
                maxLength={WATCH_TITLE_MAX_LENGTH}
                returnKeyType="next"
                testID="watch-title-input"
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('entertainment.form.kindLabel')}
                </AppText>
                <View style={styles.optionRow}>
                  {WATCH_KINDS.map((kind: WatchKind) => (
                    <Chip
                      key={kind}
                      label={t(`entertainment.kinds.${kind}`)}
                      selected={form.kind === kind}
                      onPress={() => form.setKind(kind)}
                      testID={`watch-kind-${kind}`}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('entertainment.form.statusLabel')}
                </AppText>
                <View style={styles.optionRow}>
                  {WATCH_STATUSES.map((status: WatchStatus) => (
                    <Chip
                      key={status}
                      label={t(`entertainment.statuses.${status}`)}
                      selected={form.status === status}
                      onPress={() => form.setStatus(status)}
                      testID={`watch-status-${status}`}
                    />
                  ))}
                </View>
              </View>

              <TextField
                label={t('entertainment.form.urlLabel')}
                value={form.url}
                onChangeText={form.setUrl}
                placeholder={t('entertainment.form.urlPlaceholder')}
                error={form.urlError ? translateValidationCode(form.urlError, t) : null}
                optional
                maxLength={WATCH_URL_MAX_LENGTH}
                keyboardType="url"
                testID="watch-url-input"
              />

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('entertainment.form.ratingLabel')}
                </AppText>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      onPress={() =>
                        form.setRating(form.rating === star ? null : star)
                      }
                      hitSlop={8}
                      accessibilityRole="radio"
                      aria-checked={form.rating === star}
                      accessibilityLabel={`${star} / ${WATCH_RATING_MAX}`}
                      testID={`watch-rating-${star}`}
                      style={styles.star}>
                      <Ionicons
                        name={
                          form.rating !== null && star <= form.rating
                            ? 'star'
                            : 'star-outline'
                        }
                        size={IconSize.lg}
                        color={Colors.accentGold}
                      />
                    </Pressable>
                  ))}
                  {form.rating !== null ? (
                    <Button
                      label={t('entertainment.form.clearRating')}
                      variant="secondary"
                      size="sm"
                      onPress={() => form.setRating(null)}
                      testID="watch-rating-clear"
                    />
                  ) : null}
                </View>
              </View>

              <TextField
                label={t('entertainment.form.notesLabel')}
                value={form.notes}
                onChangeText={form.setNotes}
                placeholder={t('entertainment.form.notesPlaceholder')}
                error={form.notesError ? translateValidationCode(form.notesError, t) : null}
                optional
                multiline
                maxLength={WATCH_NOTES_MAX_LENGTH}
                testID="watch-notes-input"
              />

              <View style={styles.actions}>
                <Button
                  label={form.isEdit ? t('entertainment.form.save') : t('entertainment.form.add')}
                  onPress={handleSave}
                  loading={form.saving}
                  disabled={form.deleting}
                  fullWidth
                  testID="save-watch-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={busy}
                  fullWidth
                  testID="cancel-watch-button"
                />
              </View>

              {form.isEdit ? (
                <View style={styles.destructiveZone}>
                  <Button
                    label={t('entertainment.form.delete')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={form.deleting}
                    disabled={form.saving}
                    fullWidth
                    icon={<Ionicons name="trash-outline" size={IconSize.sm} color={Colors.danger} />}
                    testID="delete-watch-button"
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
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  star: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
});
