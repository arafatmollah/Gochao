import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useTranslation } from '@/i18n';
import { CardShadow, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

export const CONTACT_URL = 'https://github.com/arafatmollah/Gochao/issues';

export default function AboutScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
          icon="arrow-down-circle-outline"
          title={t('about.updateEntry')}
          hint={t('about.updateEntryHint')}
          onPress={() => router.push('/about-update')}
          testID="about-update-entry"
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
        <AboutRow
          icon="chatbox-ellipses-outline"
          title={t('about.feedbackEntry')}
          hint={t('about.feedbackEntryHint')}
          onPress={() => router.push('/feedback')}
          testID="about-feedback-entry"
        />
        <LinearGradient
          colors={[colors.hero, colors.primaryPressed]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.signature}>
          <View style={styles.signatureMedallion} testID="about-signature">
            <Ionicons name="code-slash" size={IconSize.lg} color={colors.heroText} />
          </View>
          <AppText variant="caption" style={styles.signatureLabel}>
            {t('about.builtByLabel')}
          </AppText>
          <AppText variant="heroValue" style={styles.signatureName}>
            Arafat Shuvo
          </AppText>
        </LinearGradient>
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={IconSize.md} color={colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" color="textSecondary">
          {hint}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...CardShadow,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  signature: {
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
  signatureMedallion: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.heroTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureLabel: {
    color: colors.heroMuted,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  signatureName: {
    color: colors.heroText,
  },
});
