import { DATABASE_NAME } from '@/db/database';

/**
 * Backup & restore configuration.
 *
 * Backups live in the Google Drive `appDataFolder` — hidden per-app storage
 * tied to the user's Google account, visible to no other app and never
 * mixed with their visible Drive files.
 *
 * SETUP REQUIRED (one time, by the app owner in Google Cloud Console):
 * 1. Create a project at https://console.cloud.google.com, enable the
 *    Google Drive API, and create an OAuth client of type "Web application".
 * 2. Paste its client ID below as GOOGLE_WEB_CLIENT_ID.
 * 3. On the OAuth consent screen add the
 *    `.../auth/drive.appdata` scope; personal-use builds show an
 *    "unverified app" warning until Google verifies the app.
 * 4. Android release builds additionally need the APK signing certificate's
 *    SHA-1 registered as an Android OAuth client for the same project
 *    (the CI APK is debug-signed; use its debug SHA-1, or a real keystore
 *    for store releases). iOS builds need the reversed-client-ID URL scheme
 *    passed to the `@react-native-google-signin/google-signin` config
 *    plugin (see its README).
 */

/** OAuth client ID of type "Web application", or empty when not configured. */
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';

export function isBackupConfigured(clientId: string = GOOGLE_WEB_CLIENT_ID): boolean {
  return clientId.trim().length > 0;
}

/** Google API scope for hidden per-app Drive storage. */
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

/** Backup file name inside both local storage and Drive appDataFolder. */
export const BACKUP_FILE_NAME = DATABASE_NAME;

/** Whole hours between automatic backups (daily). */
export const BACKUP_INTERVAL_HOURS = 24;

/** app_settings keys backing the backup feature (no migration needed). */
export const BACKUP_EMAIL_KEY = 'backup.email';
export const BACKUP_AUTO_KEY = 'backup.auto';
export const BACKUP_LAST_AT_KEY = 'backup.lastAt';
export const BACKUP_FILE_ID_KEY = 'backup.fileId';
