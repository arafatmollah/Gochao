import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import {
  usePrayerSettings,
  PRAYER_CITY_MAX_LENGTH,
} from '@/features/prayer/hooks/use-prayer-settings';
import { translateValidationCode } from '@/i18n/errors';
import { useTranslation } from '@/i18n';
import { Colors, IconSize, Spacing } from '@/theme/tokens';
import {
  PRAYERS,
  PRAYER_CALCULATION_METHODS,
  PRAYER_MADHABS,
  type PrayerCalculationMethod,
  type PrayerMadhab,
  type PrayerName,
} from '@/types/prayer';

export default function PrayerSettingsScreen() {
  const { t } = useTranslation();
  const form = usePrayerSettings();

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/prayer');
  }

  async function handleSave() {
    const saved = await form.submit();
    if (saved) {
      goBack();
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t('prayer.settingsTitle') }} />
      <Screen edges={['bottom']}>
        {form.loadState === 'loading' ? (
          <LoadingState label={t('prayer.settingsLoading')} />
        ) : form.loadState === 'error' ? (
          <ErrorState
            title={t('prayer.settingsErrorTitle')}
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
                  {t('prayer.methodLabel')}
                </AppText>
                <View style={styles.optionRow}>
                  {PRAYER_CALCULATION_METHODS.map((method: PrayerCalculationMethod) => (
                    <Chip
                      key={method}
                      label={t(`prayer.methods.${method}`)}
                      selected={form.method === method}
                      onPress={() => form.setMethod(method)}
                      testID={`prayer-method-${method}`}
                    />
                  ))}
                </View>
                <AppText variant="caption" color="textMuted">
                  {t('prayer.methodHint')}
                </AppText>
              </View>

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('prayer.madhabLabel')}
                </AppText>
                <View style={styles.optionRow}>
                  {PRAYER_MADHABS.map((madhab: PrayerMadhab) => (
                    <Chip
                      key={madhab}
                      label={t(`prayer.madhabs.${madhab}`)}
                      selected={form.madhab === madhab}
                      onPress={() => form.setMadhab(madhab)}
                      testID={`prayer-madhab-${madhab}`}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('prayer.locationLabel')}
                </AppText>
                <Button
                  label={form.locating ? t('prayer.locating') : t('prayer.useMyLocation')}
                  variant="secondary"
                  size="sm"
                  onPress={() => void form.detectLocation()}
                  loading={form.locating}
                  disabled={form.saving}
                  icon={
                    <Ionicons name="locate-outline" size={IconSize.sm} color={Colors.text} />
                  }
                  testID="prayer-use-location-button"
                />
                {form.locateError ? <Banner message={form.locateError} /> : null}
                <TextField
                  label={t('prayer.cityLabel')}
                  value={form.city}
                  onChangeText={form.setCity}
                  placeholder={t('prayer.cityPlaceholder')}
                  error={form.cityError ? translateValidationCode(form.cityError, t) : null}
                  maxLength={PRAYER_CITY_MAX_LENGTH}
                  testID="prayer-city-input"
                />
                <View style={styles.coordinateRow}>
                  <View style={styles.coordinateField}>
                    <TextField
                      label={t('prayer.latitudeLabel')}
                      value={form.latitudeText}
                      onChangeText={form.setLatitudeText}
                      placeholder="23.8103"
                      error={
                        form.latitudeError
                          ? translateValidationCode(form.latitudeError, t)
                          : null
                      }
                      keyboardType="decimal-pad"
                      testID="prayer-latitude-input"
                    />
                  </View>
                  <View style={styles.coordinateField}>
                    <TextField
                      label={t('prayer.longitudeLabel')}
                      value={form.longitudeText}
                      onChangeText={form.setLongitudeText}
                      placeholder="90.4125"
                      error={
                        form.longitudeError
                          ? translateValidationCode(form.longitudeError, t)
                          : null
                      }
                      keyboardType="decimal-pad"
                      testID="prayer-longitude-input"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('prayer.adjustLabel')}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {t('prayer.adjustHint')}
                </AppText>
                {form.adjustError ? (
                  <Banner message={translateValidationCode(form.adjustError, t)} />
                ) : null}
                {PRAYERS.map((prayer: PrayerName) => (
                  <TextField
                    key={prayer}
                    label={t(`prayer.names.${prayer}`)}
                    value={form.adjustTexts[prayer]}
                    onChangeText={(value) => form.setAdjustText(prayer, value)}
                    placeholder="0"
                    keyboardType="numbers-and-punctuation"
                    testID={`prayer-adjust-${prayer}-input`}
                  />
                ))}
              </View>

              <AppText variant="caption" color="textMuted">
                {t('prayer.deviceTzNote')}
              </AppText>

              <View style={styles.fieldGroup}>
                <AppText variant="label" color="textSecondary">
                  {t('prayer.remindersLabel')}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {t('prayer.remindersHint')}
                </AppText>
                {form.remindersEnabled ? (
                  <AppText variant="caption" color="textSecondary">
                    {t('prayer.remindersOn')}
                  </AppText>
                ) : null}
                {form.remindersError ? <Banner message={form.remindersError} /> : null}
                <Button
                  label={
                    form.remindersEnabled
                      ? t('prayer.disableReminders')
                      : t('prayer.enableReminders')
                  }
                  variant="secondary"
                  size="sm"
                  onPress={() => void form.toggleReminders()}
                  loading={form.togglingReminders}
                  disabled={form.saving}
                  icon={
                    <Ionicons
                      name={
                        form.remindersEnabled
                          ? 'notifications-off-outline'
                          : 'notifications-outline'
                      }
                      size={IconSize.sm}
                      color={Colors.text}
                    />
                  }
                  testID="prayer-reminders-toggle"
                />
                <AppText variant="caption" color="textMuted">
                  {t('prayer.remindersAndroidNote')}
                </AppText>
              </View>

              <View style={styles.actions}>
                <Button
                  label={t('prayer.save')}
                  onPress={handleSave}
                  loading={form.saving}
                  fullWidth
                  testID="save-prayer-settings-button"
                />
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={goBack}
                  disabled={form.saving}
                  fullWidth
                  testID="cancel-prayer-settings-button"
                />
              </View>
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
  coordinateRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  coordinateField: {
    flex: 1,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
