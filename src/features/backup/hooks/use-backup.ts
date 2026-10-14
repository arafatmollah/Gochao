import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import * as Network from 'expo-network';

import { SqliteSettingsRepository } from '@/db/repositories/settings-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import {
  BACKUP_AUTO_KEY,
  BACKUP_EMAIL_KEY,
  BACKUP_FILE_ID_KEY,
  BACKUP_LAST_AT_KEY,
  isBackupConfigured,
} from '@/services/backup-config';
import { createSnapshot, replaceLiveDatabase } from '@/services/backup';
import { createGoogleAuth } from '@/services/google-auth';
import {
  downloadBackupFile,
  findBackupFile,
  uploadBackupFile,
} from '@/services/google-drive';
import { nowIso } from '@/utils/time';

export interface UseBackupResult {
  /** True when a Google OAuth Client ID is present. */
  isConfigured: boolean;
  /** Signed-in Google account email, or null. */
  accountEmail: string | null;
  autoBackup: boolean;
  lastBackupAt: string | null;
  signingIn: boolean;
  backingUp: boolean;
  restoring: boolean;
  error: string | null;
  notice: string | null;
  clearNotice: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  backupNow: () => Promise<boolean>;
  restoreNow: () => Promise<boolean>;
  setAutoBackup: (enabled: boolean) => Promise<void>;
}

function isCancelMessage(message: string): boolean {
  return message.toLowerCase().includes('cancel');
}

/**
 * Google Drive backup state (appDataFolder). Everything is best-effort and
 * user-initiated except the silent daily run in `BackupBootstrap`: failures
 * surface as translated messages, never exceptions.
 */
export function useBackup(): UseBackupResult {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const settings = useMemo(() => new SqliteSettingsRepository(toSqlDatabase(db)), [db]);
  const auth = useMemo(() => createGoogleAuth(), []);

  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [autoBackup, setAutoBackupState] = useState(true);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [email, auto, lastAt, fileId] = await Promise.all([
          settings.get(BACKUP_EMAIL_KEY),
          settings.get(BACKUP_AUTO_KEY),
          settings.get(BACKUP_LAST_AT_KEY),
          settings.get(BACKUP_FILE_ID_KEY),
        ]);
        if (!active) {
          return;
        }
        setAccountEmail(email);
        setAutoBackupState(auto === null ? true : auto === '1');
        setLastBackupAt(lastAt);
        setDriveFileId(fileId);
      } catch {
        // Defaults stand; the screen still works.
      }
    })();
    return () => {
      active = false;
    };
  }, [settings]);

  const fail = useCallback(
    (unknownError: unknown) => {
      const raw = unknownError instanceof Error ? unknownError.message : String(unknownError);
      setError(
        isCancelMessage(raw) ? t('backup.errors.cancelled') : translateError(unknownError, t),
      );
    },
    [t],
  );

  const signIn = useCallback(async () => {
    if (signingIn) {
      return;
    }
    if (!isBackupConfigured()) {
      setError(t('backup.errors.notConfigured'));
      return;
    }
    setError(null);
    setNotice(null);
    setSigningIn(true);
    try {
      auth.configure();
      const account = await auth.signIn();
      await settings.set(BACKUP_EMAIL_KEY, account.email);
      setAccountEmail(account.email);
      setNotice(t('backup.signedIn'));
    } catch (signInError) {
      fail(signInError);
    } finally {
      setSigningIn(false);
    }
  }, [signingIn, auth, settings, t, fail]);

  const signOut = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      auth.configure();
      await auth.signOut();
    } catch {
      // Local sign-out proceeds regardless.
    }
    try {
      await settings.set(BACKUP_EMAIL_KEY, '');
    } catch {
      // Preference loss only affects the next cold start.
    }
    setAccountEmail(null);
  }, [auth, settings]);

  /** Fresh access token, attempting a silent re-auth once when needed. */
  const freshAccessToken = useCallback(async (): Promise<string> => {
    try {
      return await auth.getAccessToken();
    } catch {
      auth.configure();
      await auth.signInSilently();
      return auth.getAccessToken();
    }
  }, [auth]);

  const backupNow = useCallback(async (): Promise<boolean> => {
    if (backingUp || restoring) {
      return false;
    }
    if (!isBackupConfigured()) {
      setError(t('backup.errors.notConfigured'));
      return false;
    }
    if (!accountEmail) {
      setError(t('backup.errors.signedOut'));
      return false;
    }
    setError(null);
    setNotice(null);
    setBackingUp(true);
    try {
      const state = await Network.getNetworkStateAsync();
      if (state.isConnected === false) {
        setError(t('backup.errors.offline'));
        return false;
      }
      auth.configure();
      const accessToken = await freshAccessToken();
      const snapshot = await createSnapshot(toSqlDatabase(db));
      let uploaded = await uploadBackupFile(fetch, accessToken, snapshot, driveFileId);
      if (!uploaded.id && driveFileId) {
        // Stored file id went stale (deleted on Drive): create anew.
        uploaded = await uploadBackupFile(fetch, accessToken, snapshot, null);
      }
      if (!uploaded.id) {
        setError(t('backup.errors.server'));
        return false;
      }
      const stamped = nowIso();
      await settings.set(BACKUP_LAST_AT_KEY, stamped);
      await settings.set(BACKUP_FILE_ID_KEY, uploaded.id);
      setLastBackupAt(stamped);
      setDriveFileId(uploaded.id);
      setNotice(t('backup.backupDone'));
      return true;
    } catch (backupError) {
      fail(backupError);
      return false;
    } finally {
      setBackingUp(false);
    }
  }, [backingUp, restoring, accountEmail, driveFileId, auth, settings, db, t, fail, freshAccessToken]);

  const restoreNow = useCallback(async (): Promise<boolean> => {
    if (restoring || backingUp) {
      return false;
    }
    if (!isBackupConfigured()) {
      setError(t('backup.errors.notConfigured'));
      return false;
    }
    if (!accountEmail) {
      setError(t('backup.errors.signedOut'));
      return false;
    }
    setError(null);
    setNotice(null);
    setRestoring(true);
    try {
      const state = await Network.getNetworkStateAsync();
      if (state.isConnected === false) {
        setError(t('backup.errors.offline'));
        return false;
      }
      auth.configure();
      const accessToken = await freshAccessToken();
      let fileId = driveFileId;
      if (!fileId) {
        const found = await findBackupFile(fetch, accessToken);
        if (found.error || !found.file) {
          setError(t('backup.errors.noBackup'));
          return false;
        }
        fileId = found.file.id;
      }
      const downloaded = await downloadBackupFile(fetch, accessToken, fileId);
      if (downloaded.error || !downloaded.bytes) {
        setError(t('backup.errors.server'));
        return false;
      }
      try {
        await replaceLiveDatabase(downloaded.bytes);
      } catch {
        setError(t('backup.errors.invalidBackup'));
        return false;
      }
      setNotice(t('backup.restoreDone'));
      return true;
    } catch (restoreError) {
      fail(restoreError);
      return false;
    } finally {
      setRestoring(false);
    }
  }, [restoring, backingUp, accountEmail, driveFileId, auth, t, fail, freshAccessToken]);

  const setAutoBackup = useCallback(
    async (enabled: boolean) => {
      setAutoBackupState(enabled);
      try {
        await settings.set(BACKUP_AUTO_KEY, enabled ? '1' : '0');
      } catch {
        // Toggle still applies for this session.
      }
    },
    [settings],
  );

  return {
    isConfigured: isBackupConfigured(),
    accountEmail,
    autoBackup,
    lastBackupAt,
    signingIn,
    backingUp,
    restoring,
    error,
    notice,
    clearNotice: () => {
      setNotice(null);
      setError(null);
    },
    signIn,
    signOut,
    backupNow,
    restoreNow,
    setAutoBackup,
  };
}
