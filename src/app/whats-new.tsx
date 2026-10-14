import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { CHANGELOG } from '@/features/about/changelog';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';

export default function WhatsNewScreen() {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const entry = CHANGELOG.find((item) => item.version === version) ?? CHANGELOG[CHANGELOG.length - 1];

  function close() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }

  function openHistory() {
    router.push('/about-version-history');
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        kicker={t('more.aboutVersion', { version })}
        title={t('about.whatsNewTitle')}
        testID="whats-new-header"
      />
      <ScrollView contentContainerStyle={styles.content}>
        {entry ? (
          <Card style={styles.card} testID="whats-new-entry">
            <AppText variant="bodyStrong">{entry.version}</AppText>
            <AppText variant="body" color="textSecondary">
              {t(entry.highlightsKey)}
            </AppText>
          </Card>
        ) : null}
        <View style={styles.actions}>
          <Button
            label={t('about.whatsNewHistory')}
            variant="secondary"
            onPress={openHistory}
            testID="whats-new-history-button"
          />
          <Button
            label={t('about.whatsNewClose')}
            onPress={close}
            testID="whats-new-close-button"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  card: {
    gap: Spacing.sm,
  },
  actions: {
    gap: Spacing.sm,
  },
});
