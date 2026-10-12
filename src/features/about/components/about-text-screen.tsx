import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Spacing } from '@/theme/tokens';

/**
 * Renders a long localized legal text (terms, privacy). The body copy lives
 * in the locale dictionaries so both languages ship the full text.
 */
export function AboutTextScreen({
  title,
  body,
  headerTestID,
  bodyTestID,
  backFallback,
}: {
  title: string;
  body: string;
  headerTestID: string;
  bodyTestID: string;
  backFallback: '/about' | '/more';
}) {
  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backFallback);
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={title} onBack={goBack} testID={headerTestID} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="body" color="text" testID={bodyTestID}>
          {body}
        </AppText>
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
});
