import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { CHANGELOG } from '@/features/about/changelog';
import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/theme-context';
import { Spacing } from '@/theme/tokens';

export default function AboutVersionHistoryScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/about');
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        kicker={t('more.aboutVersion', { version })}
        title={t('about.versionHistoryTitle')}
        onBack={goBack}
        testID="about-version-header"
      />
      <ScrollView contentContainerStyle={styles.content}>
        {CHANGELOG.map((entry) => (
          <Card
            key={entry.version}
            style={styles.card}
            testID={`about-version-${entry.version.replace(/\./g, '-')}`}>
            <View style={styles.versionRow}>
              <AppText variant="bodyStrong">{entry.version}</AppText>
              <Badge
                label={t('more.aboutVersion', { version })}
                color={colors.primary}
                backgroundColor={colors.primarySoft}
              />
            </View>
            <AppText variant="body" color="textSecondary">
              {t(entry.highlightsKey)}
            </AppText>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxxl,
  },
  card: {
    gap: Spacing.sm,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
});
