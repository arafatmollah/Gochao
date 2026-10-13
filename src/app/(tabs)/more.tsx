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
import { CardShadow, IconSize, Radius, Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import { THEMES, THEME_IDS } from '@/theme/themes';
import type { ThemeColors } from '@/theme/tokens';
import { useMemo } from 'react';

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
  const { colors, theme, setTheme } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Screen edges={['top']}>
      <ScreenHeader kicker={t('more.kicker')} title={t('more.title')} testID="more-header" />

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => router.push('/search')}
          accessibilityRole="button"
          accessibilityLabel={t('search.title')}
          testID="more-search-entry"
          style={({ pressed }) => [styles.searchBar, pressed && styles.entryCardPressed]}>
          <Ionicons name="search" size={IconSize.md} color={colors.textMuted} />
          <AppText variant="body" color="textSecondary">
            {t('search.entryHint')}
          </AppText>
        </Pressable>

        <Pressable
          onPress={() => router.push('/family')}
          accessibilityRole="button"
          accessibilityLabel={t('more.familyEntry')}
          testID="more-family-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="people-outline" size={IconSize.md} color={colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.familyEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.familyEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/notes')}
          accessibilityRole="button"
          accessibilityLabel={t('more.notesEntry')}
          testID="more-notes-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="document-text-outline" size={IconSize.md} color={colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.notesEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.notesEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/grocery')}
          accessibilityRole="button"
          accessibilityLabel={t('more.groceryEntry')}
          testID="more-grocery-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="cart-outline" size={IconSize.md} color={colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.groceryEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.groceryEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/prayer')}
          accessibilityRole="button"
          accessibilityLabel={t('more.prayerEntry')}
          testID="more-prayer-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="moon-outline" size={IconSize.md} color={colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.prayerEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.prayerEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/health')}
          accessibilityRole="button"
          accessibilityLabel={t('more.healthEntry')}
          testID="more-health-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="medkit-outline" size={IconSize.md} color={colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.healthEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.healthEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/entertainment')}
          accessibilityRole="button"
          accessibilityLabel={t('more.entertainmentEntry')}
          testID="more-entertainment-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="film-outline" size={IconSize.md} color={colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.entertainmentEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.entertainmentEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/about')}
          accessibilityRole="button"
          accessibilityLabel={t('more.aboutEntry')}
          testID="more-about-entry"
          style={({ pressed }) => [styles.entryCard, pressed && styles.entryCardPressed]}>
          <View style={styles.entryIcon}>
            <Ionicons name="information-circle-outline" size={IconSize.md} color={colors.primary} />
          </View>
          <View style={styles.entryBody}>
            <AppText variant="bodyStrong">{t('more.aboutEntry')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('more.aboutEntryHint')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
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
          <AppText variant="subheading">{t('theme.title')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('theme.hint')}
          </AppText>
          <View style={styles.themeList}>
            {THEME_IDS.map((id) => {
              const active = theme === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    void setTheme(id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={t(`theme.names.${id}`)}
                  testID={`theme-option-${id}`}
                  style={({ pressed }) => [
                    styles.themeRow,
                    active && styles.themeRowActive,
                    pressed && styles.entryCardPressed,
                  ]}>
                  <View style={[styles.swatch, { backgroundColor: THEMES[id].primary }]} />
                  <AppText variant="body" style={styles.themeLabel}>
                    {t(`theme.names.${id}`)}
                  </AppText>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={IconSize.md} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
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
                <Ionicons name={module.icon} size={IconSize.md} color={colors.textSecondary} />
                <AppText variant="body" style={styles.moduleLabel}>
                  {t(`more.modules.${module.key}`)}
                </AppText>
                <Badge
                  label={t('more.phaseBadge', { phase: module.phase })}
                  color={colors.textMuted}
                  backgroundColor={colors.surfaceMuted}
                />
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...CardShadow,
  },
  entryCardPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    minHeight: 46,
    ...CardShadow,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: colors.primarySoft,
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
  themeList: {
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  themeRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  themeLabel: {
    flex: 1,
  },
});
