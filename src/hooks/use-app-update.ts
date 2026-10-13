import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useTranslation } from '@/i18n';
import {
  compareVersions,
  downloadApk,
  fetchLatestRelease,
  installApk,
  type ReleaseInfo,
} from '@/services/app-update';
import { getNotificationPermission } from '@/services/daily-notifications';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UseAppUpdateResult {
  currentVersion: string;
  status: UpdateStatus;
  /** Latest release from GitHub, or null when none is published yet. */
  release: ReleaseInfo | null;
  updateAvailable: boolean;
  /** 0..1 download share, or null while the total size is unknown. */
  progress: number | null;
  error: string | null;
  clearError: () => void;
  check: () => void;
  download: () => void;
  install: () => void;
}

/**
 * In-app update flow against GitHub Releases. Checks run only on demand
 * (screen mount + explicit tap) — never in the background — matching the
 * privacy posture of no unsolicited network traffic.
 */
export function useAppUpdate(): UseAppUpdateResult {
  const { t } = useTranslation();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const apkUriRef = useRef<string | null>(null);
  const importantNotifiedRef = useRef<string | null>(null);

  const currentVersion = Constants.expoConfig?.version ?? '1.0.0';
  const updateAvailable =
    release !== null && compareVersions(release.version, currentVersion) > 0;

  const check = useCallback(() => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setStatus('checking');
    setError(null);
    void (async () => {
      try {
        const result = await fetchLatestRelease();
        if (!result.ok) {
          setError(
            result.reason === 'network'
              ? t('update.errors.network')
              : t('update.errors.server'),
          );
          setStatus('error');
          return;
        }
        setRelease(result.release);
        setStatus('ready');
        // Best-effort local alert for important releases (no remote-push
        // backend exists): only when already permitted, never prompting,
        // and once per version per session.
        const found = result.release;
        if (
          found &&
          found.apkUrl &&
          compareVersions(found.version, currentVersion) > 0 &&
          found.important &&
          importantNotifiedRef.current !== found.tag &&
          Platform.OS !== 'web'
        ) {
          importantNotifiedRef.current = found.tag;
          try {
            if (await getNotificationPermission()) {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const Notifications = require('expo-notifications');
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: t('update.importantAlertTitle'),
                  body: t('update.importantAlertBody', { version: found.version }),
                  data: { url: '/about-update' },
                },
                trigger: null,
              });
            }
          } catch {
            // Alert is optional; the on-screen banner is the real signal.
          }
        }
      } finally {
        busyRef.current = false;
      }
    })();
  }, [t, currentVersion]);

  // One automatic check when the screen opens; refreshes are manual.
  useEffect(() => {
    check();
  }, [check]);

  const download = useCallback(() => {
    if (busyRef.current || !release?.apkUrl || Platform.OS !== 'android') {
      return;
    }
    busyRef.current = true;
    setStatus('downloading');
    setProgress(0);
    setError(null);
    const apkUrl = release.apkUrl;
    void (async () => {
      try {
        const apk = await downloadApk(apkUrl, (written, total) => {
          setProgress(total && total > 0 ? Math.min(written / total, 1) : null);
        });
        apkUriRef.current = apk.fileUri;
        setStatus('downloaded');
      } catch {
        setError(t('update.errors.download'));
        setStatus('error');
      } finally {
        busyRef.current = false;
      }
    })();
  }, [release, t]);

  const install = useCallback(() => {
    if (busyRef.current || !apkUriRef.current || Platform.OS !== 'android') {
      return;
    }
    busyRef.current = true;
    setError(null);
    void (async () => {
      try {
        await installApk(apkUriRef.current as string);
        // The system installer takes over from here; nothing to update.
      } catch {
        setError(t('update.errors.install'));
        setStatus('error');
      } finally {
        busyRef.current = false;
      }
    })();
  }, [t]);

  return {
    currentVersion,
    status,
    release,
    updateAvailable,
    progress,
    error,
    clearError: () => setError(null),
    check,
    download,
    install,
  };
}
