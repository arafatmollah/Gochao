import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { useTranslation } from '@/i18n';
import {
  buildFeedbackReport,
  FEEDBACK_CATEGORIES,
  feedbackIssueUrl,
  type FeedbackCategory,
} from '@/services/feedback';
import { useAppTheme } from '@/theme/theme-context';
import { IconSize, Spacing } from '@/theme/tokens';

export default function FeedbackScreen() {
  const { t, locale } = useTranslation();
  const { colors, theme } = useAppTheme();
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const report = useMemo(
    () =>
      buildFeedbackReport({
        category,
        message,
        includeDiagnostics,
        info: {
          appVersion: Constants.expoConfig?.version ?? '1.0.0',
          brand: Device.brand,
          model: Device.modelName,
          os: [Device.osName, Device.osVersion].filter(Boolean).join(' ') || 'Unknown',
          locale,
          theme,
        },
      }),
    [category, message, includeDiagnostics, locale, theme],
  );

  const canSubmit = message.trim().length > 0 && !sending;

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/about');
  }

  async function openGitHub() {
    if (!canSubmit) {
      return;
    }
    setError(null);
    setSending(true);
    try {
      await WebBrowser.openBrowserAsync(feedbackIssueUrl(report));
    } catch {
      setError(t('feedback.submitError'));
    } finally {
      setSending(false);
    }
  }

  async function copyReport() {
    if (!canSubmit) {
      return;
    }
    try {
      await Clipboard.setStringAsync(`${report.title}\n\n${report.body}`);
      setNotice(t('feedback.copied'));
    } catch {
      setError(t('feedback.copyError'));
    }
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('feedback.title')}
        onBack={goBack}
        testID="feedback-header"
      />

      {error ? (
        <View style={styles.bannerWrapper}>
          <Banner message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}
      {notice ? (
        <View style={styles.bannerWrapper}>
          <Banner message={notice} onDismiss={() => setNotice(null)} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.chipRow}>
          {FEEDBACK_CATEGORIES.map((value) => (
            <Chip
              key={value}
              label={t(`feedback.categories.${value}`)}
              selected={category === value}
              onPress={() => setCategory(value)}
              testID={`feedback-category-${value}`}
            />
          ))}
        </View>

        <TextField
          label={t('feedback.messageLabel')}
          value={message}
          onChangeText={setMessage}
          placeholder={t('feedback.messagePlaceholder')}
          multiline
          testID="feedback-message-input"
        />

        <Pressable
          onPress={() => setIncludeDiagnostics((current) => !current)}
          accessibilityRole="checkbox"
          aria-checked={includeDiagnostics}
          accessibilityLabel={t('feedback.diagnosticsLabel')}
          testID="feedback-diagnostics-toggle"
          style={styles.checkRow}>
          <Ionicons
            name={includeDiagnostics ? 'checkmark-circle' : 'ellipse-outline'}
            size={IconSize.lg}
            color={includeDiagnostics ? colors.primary : colors.borderStrong}
          />
          <View style={styles.checkBody}>
            <AppText variant="bodyStrong">{t('feedback.diagnosticsLabel')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('feedback.diagnosticsHint')}
            </AppText>
          </View>
        </Pressable>

        <Card style={styles.card} testID="feedback-review">
          <AppText variant="subheading">{t('feedback.reviewTitle')}</AppText>
          <AppText variant="bodyStrong">{report.title}</AppText>
          <AppText variant="body" color="textSecondary">
            {report.body}
          </AppText>
        </Card>

        <Button
          label={t('feedback.submitGithub')}
          onPress={() => void openGitHub()}
          loading={sending}
          disabled={!canSubmit}
          icon={<Ionicons name="logo-github" size={IconSize.sm} color={colors.onPrimary} />}
          testID="feedback-submit-button"
        />
        <Button
          label={t('feedback.copyReport')}
          variant="secondary"
          onPress={() => void copyReport()}
          disabled={!canSubmit}
          icon={<Ionicons name="copy-outline" size={IconSize.sm} color={colors.text} />}
          testID="feedback-copy-button"
        />
      </ScrollView>
    </Screen>
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
    gap: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  checkBody: {
    flex: 1,
    gap: 2,
  },
  card: {
    gap: Spacing.sm,
  },
});
