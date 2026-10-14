import { BACKUP_FILE_NAME, BACKUP_INTERVAL_HOURS } from './backup-config';

/**
 * Backup snapshot helpers. The live database runs in WAL mode, so a plain
 * file copy could catch a torn journal — instead the snapshot is taken with
 * `VACUUM INTO` through the live connection (transaction-safe), then the
 * bytes are read and uploaded. Restores validate the SQLite magic before
 * touching the live file, and the app must be restarted afterwards.
 */

export const SQLITE_MAGIC = 'SQLite format 3\0';
/** Smallest plausible database: header plus a page. */
export const MIN_SNAPSHOT_BYTES = 512;

/** True when no backup exists or the last one is older than 24 hours. */
export function isBackupDue(lastBackupAtIso: string | null, now: Date = new Date()): boolean {
  if (!lastBackupAtIso) {
    return true;
  }
  const last = Date.parse(lastBackupAtIso);
  if (Number.isNaN(last)) {
    return true;
  }
  return now.getTime() - last >= BACKUP_INTERVAL_HOURS * 3_600_000;
}

/** True for non-empty bytes starting with the SQLite file magic. */
export function isValidSnapshot(bytes: Uint8Array): boolean {
  if (bytes.length < MIN_SNAPSHOT_BYTES) {
    return false;
  }
  const magic = SQLITE_MAGIC;
  for (let index = 0; index < magic.length; index += 1) {
    if (bytes[index] !== magic.charCodeAt(index)) {
      return false;
    }
  }
  return true;
}

/** Minimal database surface the snapshot needs (real connections satisfy it). */
export interface SnapshotDatabase {
  execAsync(source: string): Promise<void>;
}

/**
 * Minimal filesystem surface the snapshot needs. Production binds this to
 * `expo-file-system` (`VACUUM INTO` needs a plain absolute path, and the
 * `File.uri` form is `file://`-prefixed); tests inject fakes.
 */
export interface SnapshotFs {
  /** Absolute plain path of the backup scratch file (no `file://` prefix). */
  scratchPath: string;
  vacuumInto(db: SnapshotDatabase, absolutePath: string): Promise<void>;
  readBytes(absolutePath: string): Promise<Uint8Array>;
  remove(absolutePath: string): Promise<void>;
  liveDbPath: string;
  writeLiveDatabase(bytes: Uint8Array): Promise<void>;
  removeWalSiblings(): Promise<void>;
}

function quotePath(path: string): string {
  return `'${path.replace(/'/g, "''")}'`;
}

export function defaultSnapshotFs(): SnapshotFs {
  // Lazy requires keep the web bundle free of native modules.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Directory, File, Paths } = require('expo-file-system');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { defaultDatabaseDirectory } = require('expo-sqlite');
  const toPath = (uri: string): string => uri.replace(/^file:\/\//, '');
  const scratchDir = new Directory(Paths.cache, 'backup');
  const liveFile = new File(String(defaultDatabaseDirectory), BACKUP_FILE_NAME);
  return {
    scratchPath: toPath(new File(scratchDir, BACKUP_FILE_NAME).uri),
    async vacuumInto(db, absolutePath) {
      if (!scratchDir.exists) {
        scratchDir.create();
      }
      await db.execAsync(`VACUUM INTO ${quotePath(absolutePath)};`);
    },
    async readBytes(absolutePath) {
      return new File(`file://${absolutePath}`).bytes();
    },
    async remove(absolutePath) {
      const file = new File(`file://${absolutePath}`);
      if (file.exists) {
        file.delete();
      }
    },
    liveDbPath: toPath(liveFile.uri),
    async writeLiveDatabase(bytes) {
      liveFile.write(bytes);
    },
    async removeWalSiblings() {
      for (const suffix of ['-wal', '-shm', '-journal']) {
        const sibling = new File(`${liveFile.uri}${suffix}`);
        if (sibling.exists) {
          sibling.delete();
        }
      }
    },
  };
}

/** Takes a transaction-safe snapshot and returns its bytes. */
export async function createSnapshot(
  db: SnapshotDatabase,
  fs: SnapshotFs = defaultSnapshotFs(),
): Promise<Uint8Array> {
  await fs.vacuumInto(db, fs.scratchPath);
  try {
    return await fs.readBytes(fs.scratchPath);
  } finally {
    await fs.remove(fs.scratchPath);
  }
}

/**
 * Replaces the live database with validated snapshot bytes and clears stale
 * journals. The caller must restart the app afterwards: open connections
 * still point at the old file generation.
 */
export async function replaceLiveDatabase(
  bytes: Uint8Array,
  fs: SnapshotFs = defaultSnapshotFs(),
): Promise<void> {
  if (!isValidSnapshot(bytes)) {
    throw new Error('Downloaded backup is not a valid database.');
  }
  await fs.writeLiveDatabase(bytes);
  await fs.removeWalSiblings();
}
