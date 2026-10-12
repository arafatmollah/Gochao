import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useTranslation } from '@/i18n';
import { Colors, CardShadow, IconSize, Radius, Spacing } from '@/theme/tokens';

interface UpcomingModule {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Master-prompt phase that delivers the module. */
  phase: number;
}

const UPCOMING_MODULES: UpcomingModule[] = [
  { key: 'backup', icon: 'cloud-download-outline', phase: 9 },
];

export default function MoreScreen() {
  const { t, locale, setLocale } = useTranslation();

  return (
    <Screen edges={['top']}>
      <ScreenHeader kicker={t('more.kicker')} title={t('more.title')} testID="more-header" />

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => router.push('/family')}
          accessibilityRole="button"
          accessibilityLabel={t('more.familyEntry')}
          testID="more-family-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="people-outline" size={IconSize.md} color={Colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.familyEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.familyEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/notes')}
          accessibilityRole="button"
          accessibilityLabel={t('more.notesEntry')}
          testID="more-notes-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="document-text-outline" size={IconSize.md} color={Colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.notesEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.notesEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/grocery')}
          accessibilityRole="button"
          accessibilityLabel={t('more.groceryEntry')}
          testID="more-grocery-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="cart-outline" size={IconSize.md} color={Colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.groceryEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.groceryEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/prayer')}
          accessibilityRole="button"
          accessibilityLabel={t('more.prayerEntry')}
          testID="more-prayer-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="moon-outline" size={IconSize.md} color={Colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.prayerEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.prayerEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/health')}
          accessibilityRole="button"
          accessibilityLabel={t('more.healthEntry')}
          testID="more-health-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="medkit-outline" size={IconSize.md} color={Colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.healthEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.healthEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/entertainment')}
          accessibilityRole="button"
          accessibilityLabel={t('more.entertainmentEntry')}
          testID="more-entertainment-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="film-outline" size={IconSize.md} color={Colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.entertainmentEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.entertainmentEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/about')}
          accessibilityRole="button"
          accessibilityLabel={t('more.aboutEntry')}
          testID="more-about-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="information-circle-outline" size={IconSize.md} color={Colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.aboutEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.aboutEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.textMuted} />
        </Pressable>

        <Card style={styles.card}>
          <AppText variant="subheading">{t('more.languageTitle')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('more.languageHint')}
          </AppText>
          <View style={styles.languageRow}>
            <Chip
              label={t('more.english')}
              selected={locale === 'en'}
              onPress={() => {
                void setLocale('en');
              }}
              testID="language-en"
            />
            <Chip
              label={t('more.bangla')}
              selected={locale === 'bn'}
              onPress={() => {
                void setLocale('bn');
              }}
              testID="language-bn"
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <AppText variant="subheading">{t('more.upcomingTitle')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('more.upcomingHint')}
          </AppText>
          <View style={styles.moduleList}>
            {UPCOMING_MODULES.map((module) => (
              <View key={module.key} style={styles.moduleRow}>
                <Ionicons name={module.icon} size={IconSize.md} color={Colors.textSecondary} />
                <AppText variant="body" style={styles.moduleLabel}>
                  {t(`more.modules.${module.key}`)}
                </AppText>
                <Badge
                  label={t('more.phaseBadge', { phase: module.phase })}
                  color={Colors.textMuted}
                  backgroundColor={Colors.surfaceMuted}
                />
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 96,
    gap: Spacing.md,
  },
  card: {
    gap: Spacing.xs,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...CardShadow,
  },
  entryCardPressed: {
    backgroundColor: Colors.surfaceMuted,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryBody: {
    flex: 1,
    gap: 2,
  },
  languageRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  moduleList: {
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  moduleLabel: {
    flex: 1,
  },
});
