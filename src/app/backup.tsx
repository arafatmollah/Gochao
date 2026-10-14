import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useBackup } from '@/features/backup/hooks/use-backup';
import { formatIsoDateDisplay, formatWallClock12 } from '@/i18n/format';
import { useTranslation, type Locale, type TranslateFn } from '@/i18n';
import { IconSize, Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

function formatBackupTime(iso: string, t: TranslateFn, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${formatIsoDateDisplay(day, t)} · ${formatWallClock12(`${pad(date.getHours())}:${pad(date.getMinutes())}`, locale)}`;
}

export default function BackupScreen() {
  const { t, locale } = useTranslation();
  const { colors } = useAppTheme();
  const backup = useBackup();
  const [restoreArmed, setRestoreArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (disarmTimer.current) {
        clearTimeout(disarmTimer.current);
      }
    },
    [],
  );

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/more');
  }

  function onRestorePress() {
    if (!restoreArmed) {
      setRestoreArmed(true);
      disarmTimer.current = setTimeout(() => setRestoreArmed(false), 10_000);
      return;
    }
    if (disarmTimer.current) {
      clearTimeout(disarmTimer.current);
    }
    setRestoreArmed(false);
    void backup.restoreNow();
  }

  const busy = backup.signingIn || backup.backingUp || backup.restoring;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('backup.title')} onBack={goBack} testID="backup-header" />

      {backup.error ? (
        <View style={styles.bannerWrapper}>
          <Banner message={backup.error} onDismiss={backup.clearNotice} />
        </View>
      ) : null}
      {!backup.isConfigured && !backup.error ? (
        <View style={styles.bannerWrapper}>
          <Banner
            tone="info"
            message={t('backup.errors.notConfigured')}
            testID="backup-not-configured-banner"
          />
        </View>
      ) : null}
      {backup.notice ? (
        <View style={styles.bannerWrapper}>
          <Banner message={backup.notice} onDismiss={backup.clearNotice} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card} testID="backup-account-card">
          <AppText variant="subheading">{t('backup.accountTitle')}</AppText>
          {backup.accountEmail ? (
            <>
              <AppText variant="body">{backup.accountEmail}</AppText>
              <Button
                label={t('backup.signOut')}
                variant="secondary"
                size="sm"
                onPress={() => void backup.signOut()}
                disabled={busy}
                icon={<Ionicons name="log-out-outline" size={IconSize.sm} color={colors.text} />}
                testID="backup-sign-out"
              />
            </>
          ) : (
            <>
              <AppText variant="caption" color="textSecondary">
                {t('backup.signedOutHint')}
              </AppText>
              <Button
                label={t('backup.signIn')}
                onPress={() => void backup.signIn()}
                loading={backup.signingIn}
                disabled={busy}
                icon={<Ionicons name="logo-google" size={IconSize.sm} color={colors.onPrimary} />}
                testID="backup-sign-in"
              />
            </>
          )}
        </Card>

        <Card style={styles.card}>
          <AppText variant="subheading">{t('backup.autoLabel')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('backup.autoHint')}
          </AppText>
          <Button
            label={backup.autoBackup ? t('backup.autoOn') : t('backup.autoOff')}
            variant="secondary"
            size="sm"
            onPress={() => void backup.setAutoBackup(!backup.autoBackup)}
            icon={
                <Ionicons
                  name={backup.autoBackup ? 'checkmark-circle' : 'ellipse-outline'}
                  size={IconSize.sm}
                  color={colors.text}
                />
            }
            testID="backup-auto-toggle"
          />
          <AppText variant="caption" color="textSecondary">
            {backup.lastBackupAt
              ? t('backup.lastBackup', {
                  when: formatBackupTime(backup.lastBackupAt, t, locale),
                })
              : t('backup.neverBackedUp')}
          </AppText>
          <Button
            label={t('backup.backupNow')}
            onPress={() => void backup.backupNow()}
            loading={backup.backingUp}
            disabled={busy}
            icon={<Ionicons name="cloud-upload-outline" size={IconSize.sm} color={colors.onPrimary} />}
            testID="backup-now"
          />
        </Card>

        <Card style={styles.card}>
          <AppText variant="subheading">{t('backup.restoreLabel')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('backup.restoreHint')}
          </AppText>
          <Button
            label={restoreArmed ? t('backup.restoreArm') : t('backup.restoreLabel')}
            variant="danger"
            onPress={onRestorePress}
            loading={backup.restoring}
            disabled={busy}
            icon={<Ionicons name="cloud-download-outline" size={IconSize.sm} color={colors.danger} />}
            testID="backup-restore"
          />
        </Card>
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
  card: {
    gap: Spacing.sm,
  },
});
