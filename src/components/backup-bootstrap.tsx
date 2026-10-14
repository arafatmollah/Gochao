import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as Network from 'expo-network';

import { SqliteSettingsRepository } from '@/db/repositories/settings-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import {
  BACKUP_AUTO_KEY,
  BACKUP_EMAIL_KEY,
  BACKUP_FILE_ID_KEY,
  BACKUP_LAST_AT_KEY,
  isBackupConfigured,
} from '@/services/backup-config';
import { createSnapshot, isBackupDue } from '@/services/backup';
import { createGoogleAuth } from '@/services/google-auth';
import { uploadBackupFile } from '@/services/google-drive';
import { nowIso } from '@/utils/time';

/**
 * Silent daily backup on every cold start (native only). Runs when the user
 * previously signed in, left daily backups on, is online, and the last
 * backup is older than 24 hours. Best-effort and invisible: every failure
 * is swallowed — the Backup screen reports status on demand.
 */
export function BackupBootstrap() {
  const db = useSQLiteContext();

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    void (async () => {
      try {
        const settings = new SqliteSettingsRepository(toSqlDatabase(db));
        const [email, auto, lastAt] = await Promise.all([
          settings.get(BACKUP_EMAIL_KEY),
          settings.get(BACKUP_AUTO_KEY),
          settings.get(BACKUP_LAST_AT_KEY),
        ]);
        if (!email || auto === '0' || !isBackupDue(lastAt) || !isBackupConfigured()) {
          return;
        }
        const state = await Network.getNetworkStateAsync();
        if (state.isConnected === false) {
          return;
        }
        const auth = createGoogleAuth();
        auth.configure();
        const account = await auth.signInSilently();
        if (!account) {
          return;
        }
        const accessToken = await auth.getAccessToken();
        const snapshot = await createSnapshot(toSqlDatabase(db));
        const fileId = await settings.get(BACKUP_FILE_ID_KEY);
        let uploaded = await uploadBackupFile(fetch, accessToken, snapshot, fileId);
        if (!uploaded.id && fileId) {
          uploaded = await uploadBackupFile(fetch, accessToken, snapshot, null);
        }
        if (!uploaded.id) {
          return;
        }
        await settings.set(BACKUP_LAST_AT_KEY, nowIso());
        await settings.set(BACKUP_FILE_ID_KEY, uploaded.id);
      } catch {
        // Silent by design.
      }
    })();
  }, [db]);

  return null;
}
