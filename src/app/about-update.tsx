import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useAppUpdate } from '@/hooks/use-app-update';
import { useTranslation } from '@/i18n';
import { IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

export default function AboutUpdateScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const {
    currentVersion,
    status,
    release,
    updateAvailable,
    progress,
    error,
    clearError,
    check,
    download,
    install,
  } = useAppUpdate();

  const isAndroid = Platform.OS === 'android';
  const busy = status === 'checking' || status === 'downloading';
  const percent = progress === null ? null : Math.round(progress * 100);

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
        kicker={t('update.currentVersion', { version: currentVersion })}
        title={t('update.title')}
        onBack={goBack}
        testID="about-update-header"
      />

      {error ? (
        <View style={styles.bannerWrapper}>
          <Banner message={error} onDismiss={clearError} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        {status === 'checking' ? (
          <AppText variant="body" color="textSecondary">
            {t('update.checking')}
          </AppText>
        ) : null}

        {status === 'ready' && !updateAvailable ? (
          <Card testID="update-up-to-date">
            <AppText variant="body">
              {release ? t('update.upToDate') : t('update.noReleases')}
            </AppText>
          </Card>
        ) : null}

        {release && updateAvailable ? (
          <Card style={styles.card} testID="update-available-card">
            <View style={styles.versionRow}>
              <AppText variant="bodyStrong">
                {t('update.availableTitle', { version: release.version })}
              </AppText>
              {release.important ? (
                <Badge
                  label={t('update.importantBadge')}
                  color={colors.heroText}
                  backgroundColor={colors.danger}
                />
              ) : null}
            </View>
            <AppText variant="bodyStrong">{t('update.notesTitle')}</AppText>
            <AppText variant="body" color="textSecondary">
              {release.notes.trim() !== '' ? release.notes : t('update.noNotes')}
            </AppText>

            {!isAndroid ? (
              <AppText variant="caption" color="textSecondary">
                {t('update.androidOnly')}
              </AppText>
            ) : !release.apkUrl ? (
              <AppText variant="caption" color="textSecondary">
                {t('update.noApk')}
              </AppText>
            ) : status === 'downloaded' ? (
              <>
                <AppText variant="body">{t('update.downloadedNote')}</AppText>
                <Button
                  label={t('update.installButton')}
                  onPress={install}
                  icon={
                    <Ionicons
                      name="arrow-down-circle-outline"
                      size={IconSize.sm}
                      color={colors.onPrimary}
                    />
                  }
                  testID="update-install-button"
                />
                <AppText variant="caption" color="textSecondary">
                  {t('update.installHint')}
                </AppText>
              </>
            ) : (
              <>
                {status === 'downloading' ? (
                  <>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${(progress ?? 0) * 100}%` }]} />
                    </View>
                    <AppText variant="caption" color="textSecondary" testID="update-progress">
                      {percent === null
                        ? t('update.downloadingUnknown')
                        : t('update.downloading', { percent })}
                    </AppText>
                  </>
                ) : null}
                <Button
                  label={t('update.downloadButton')}
                  onPress={download}
                  disabled={busy}
                  icon={
                    <Ionicons
                      name="download-outline"
                      size={IconSize.sm}
                      color={colors.onPrimary}
                    />
                  }
                  testID="update-download-button"
                />
              </>
            )}
          </Card>
        ) : null}

        <Button
          label={t('update.checkButton')}
          variant="secondary"
          onPress={check}
          disabled={busy}
          icon={<Ionicons name="refresh-outline" size={IconSize.sm} color={colors.text} />}
          testID="update-check-button"
        />
      </ScrollView>
    </Screen>
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
    gap: Spacing.md,
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
  track: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: colors.primary,
  },
});
