import { BACKUP_FILE_NAME } from './backup-config';

/**
 * Minimal Google Drive `appDataFolder` client over the REST API (no extra
 * dependencies — plain `fetch`). All calls take an OAuth access token and an
 * injectable fetch so unit tests never touch the network.
 */

export interface DriveBackupFile {
  id: string;
  modifiedTime: string;
  size: number;
}

export type DriveFailure = 'network' | 'auth' | 'server';

function driveError(status: number): DriveFailure {
  return status === 401 || status === 403 ? 'auth' : 'server';
}

/** Finds our backup file in appDataFolder, or null when never backed up. */
export async function findBackupFile(
  fetchImpl: typeof fetch,
  accessToken: string,
): Promise<{ file: DriveBackupFile | null; error?: undefined } | { file?: undefined; error: DriveFailure }> {
  let response: Response;
  try {
    const query = encodeURIComponent(`name = '${BACKUP_FILE_NAME}' and trashed = false`);
    response = await fetchImpl(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,modifiedTime,size)&pageSize=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  } catch {
    return { error: 'network' };
  }
  if (!response.ok) {
    return { error: driveError(response.status) };
  }
  try {
    const payload = (await response.json()) as { files?: DriveBackupFile[] };
    const file = Array.isArray(payload.files) ? payload.files[0] ?? null : null;
    return { file };
  } catch {
    return { error: 'server' };
  }
}

/**
 * Uploads (or replaces, when `existingFileId` is known) the backup bytes.
 * Multipart/related: JSON metadata part + raw bytes part.
 */
export async function uploadBackupFile(
  fetchImpl: typeof fetch,
  accessToken: string,
  bytes: Uint8Array,
  existingFileId: string | null,
): Promise<{ id: string; error?: undefined } | { id?: undefined; error: DriveFailure }> {
  const boundary = `gochao-${Date.now().toString(36)}`;
  const metadata = JSON.stringify({ name: BACKUP_FILE_NAME, parents: ['appDataFolder'] });
  const header =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const footer = `\r\n--${boundary}--`;
  const headerBytes = new TextEncoder().encode(header);
  const footerBytes = new TextEncoder().encode(footer);
  const body = new Uint8Array(headerBytes.length + bytes.length + footerBytes.length);
  body.set(headerBytes, 0);
  body.set(bytes, headerBytes.length);
  body.set(footerBytes, headerBytes.length + bytes.length);

  let response: Response;
  try {
    const url = existingFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    response = await fetchImpl(url, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
  } catch {
    return { error: 'network' };
  }
  if (!response.ok) {
    return { error: driveError(response.status) };
  }
  try {
    const payload = (await response.json()) as { id?: unknown };
    if (typeof payload.id !== 'string' || payload.id === '') {
      return { error: 'server' };
    }
    return { id: payload.id };
  } catch {
    return { error: 'server' };
  }
}

/** Downloads the raw backup bytes for a Drive file id. */
export async function downloadBackupFile(
  fetchImpl: typeof fetch,
  accessToken: string,
  fileId: string,
): Promise<{ bytes: Uint8Array; error?: undefined } | { bytes?: undefined; error: DriveFailure }> {
  let response: Response;
  try {
    response = await fetchImpl(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return { error: 'network' };
  }
  if (!response.ok) {
    return { error: driveError(response.status) };
  }
  try {
    const buffer = await response.arrayBuffer();
    return { bytes: new Uint8Array(buffer) };
  } catch {
    return { error: 'server' };
  }
}
