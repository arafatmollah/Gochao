import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useTranslation } from '@/i18n';
import { CardShadow, Colors, IconSize, Radius, Spacing } from '@/theme/tokens';

export const CONTACT_URL = 'https://github.com/arafatmollah/Gochao/issues';

export default function AboutScreen() {
  const { t } = useTranslation();
  const [linkError, setLinkError] = useState<string | null>(null);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/more');
  }

  async function openContact() {
    setLinkError(null);
    try {
      await WebBrowser.openBrowserAsync(CONTACT_URL);
    } catch {
      setLinkError(t('about.contactError'));
    }
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('more.aboutTitle')}
        onBack={goBack}
        testID="about-header"
      />

      {linkError ? (
        <View style={styles.bannerWrapper}>
          <Banner message={linkError} onDismiss={() => setLinkError(null)} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        <AboutRow
          icon="time-outline"
          title={t('about.versionEntry')}
          hint={t('about.versionEntryHint')}
          onPress={() => router.push('/about-version-history')}
          testID="about-version-entry"
        />
        <AboutRow
          icon="document-text-outline"
          title={t('about.termsEntry')}
          hint={t('about.termsEntryHint')}
          onPress={() => router.push('/about-terms')}
          testID="about-terms-entry"
        />
        <AboutRow
          icon="shield-checkmark-outline"
          title={t('about.privacyEntry')}
          hint={t('about.privacyEntryHint')}
          onPress={() => router.push('/about-privacy')}
          testID="about-privacy-entry"
        />
        <AboutRow
          icon="mail-outline"
          title={t('about.contactEntry')}
          hint={t('about.contactEntryHint')}
          onPress={() => void openContact()}
          testID="about-contact-entry"
        />
      </ScrollView>
    </Screen>
  );
}

function AboutRow({
  icon,
  title,
  hint,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={IconSize.md} color={Colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" color="textSecondary">
          {hint}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bannerWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...CardShadow,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceMuted,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
});
