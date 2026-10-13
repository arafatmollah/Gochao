import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

export default function AboutVersionHistoryScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
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
        <Card style={styles.card} testID="about-version-1-0-0">
          <View style={styles.versionRow}>
            <AppText variant="bodyStrong">1.0.0</AppText>
            <Badge
              label={t('more.aboutVersion', { version })}
              color={colors.primary}
              backgroundColor={colors.primarySoft}
            />
          </View>
          <AppText variant="body" color="textSecondary">
            {t('about.v100highlights')}
          </AppText>
        </Card>
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
