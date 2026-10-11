import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useTranslation } from '@/i18n';
import { Colors, IconSize, Spacing } from '@/theme/tokens';

interface UpcomingModule {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Master-prompt phase that delivers the module. */
  phase: number;
}

const UPCOMING_MODULES: UpcomingModule[] = [
  { key: 'notes', icon: 'document-text-outline', phase: 4 },
  { key: 'family', icon: 'people-outline', phase: 7 },
  { key: 'grocery', icon: 'cart-outline', phase: 7 },
  { key: 'health', icon: 'medkit-outline', phase: 8 },
  { key: 'prayer', icon: 'moon-outline', phase: 8 },
  { key: 'backup', icon: 'cloud-download-outline', phase: 9 },
];

export default function MoreScreen() {
  const { t, locale, setLocale } = useTranslation();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen edges={['top']}>
      <ScreenHeader kicker={t('more.kicker')} title={t('more.title')} testID="more-header" />

      <ScrollView contentContainerStyle={styles.content}>
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
          <AppText variant="subheading">{t('more.aboutTitle')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('more.aboutVersion', { version })}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {t('more.aboutPrivacy')}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {t('more.aboutSecurity')}
          </AppText>
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
