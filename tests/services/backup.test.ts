import {
  createSnapshot,
  isBackupDue,
  isValidSnapshot,
  replaceLiveDatabase,
  SQLITE_MAGIC,
  type SnapshotDatabase,
  type SnapshotFs,
} from '@/services/backup';
import { isBackupConfigured } from '@/services/backup-config';

function magicBytes(extra = 600): Uint8Array {
  const magic = new TextEncoder().encode(SQLITE_MAGIC);
  const bytes = new Uint8Array(extra);
  bytes.set(magic, 0);
  return bytes;
}

describe('isBackupDue', () => {
  const now = new Date('2026-10-13T12:00:00Z');

  it('is due when never backed up or the stamp is unreadable', () => {
    expect(isBackupDue(null, now)).toBe(true);
    expect(isBackupDue('not-a-date', now)).toBe(true);
  });

  it('is due after 24 hours, not before', () => {
    expect(isBackupDue('2026-10-12T12:00:00Z', now)).toBe(true);
    expect(isBackupDue('2026-10-12T12:00:01Z', now)).toBe(false);
    expect(isBackupDue('2026-10-13T11:00:00Z', now)).toBe(false);
  });
});

describe('isValidSnapshot', () => {
  it('accepts real sqlite bytes', () => {
    expect(isValidSnapshot(magicBytes())).toBe(true);
  });

  it('rejects empty, tiny, and non-sqlite payloads', () => {
    expect(isValidSnapshot(new Uint8Array(0))).toBe(false);
    expect(isValidSnapshot(new Uint8Array(600))).toBe(false);
    const garbage = new Uint8Array(600).fill(7);
    expect(isValidSnapshot(garbage)).toBe(false);
  });
});

describe('createSnapshot and replaceLiveDatabase', () => {
  it('creates snapshot by vacuuming, reading, and cleaning up scratch file', async () => {
    const executed: string[] = [];
    const db: SnapshotDatabase = {
      async execAsync(source) {
        executed.push(source);
      },
    };
    const sampleBytes = magicBytes();
    let removedScratch = false;
    const fs: SnapshotFs = {
      scratchPath: '/cache/backup/gochao.db',
      liveDbPath: '/data/gochao.db',
      async vacuumInto(targetDb, path) {
        await targetDb.execAsync(`VACUUM INTO '${path}'`);
      },
      async readBytes() {
        return sampleBytes;
      },
      async remove() {
        removedScratch = true;
      },
      async writeLiveDatabase() {},
      async removeWalSiblings() {},
    };

    const snapshot = await createSnapshot(db, fs);
    expect(snapshot).toBe(sampleBytes);
    expect(executed).toEqual(["VACUUM INTO '/cache/backup/gochao.db'"]);
    expect(removedScratch).toBe(true);
  });

  it('replaces live database and clears wal siblings when snapshot is valid', async () => {
    let writtenBytes: Uint8Array | null = null;
    let walRemoved = false;
    const fs: SnapshotFs = {
      scratchPath: '/cache/backup/gochao.db',
      liveDbPath: '/data/gochao.db',
      async vacuumInto() {},
      async readBytes() {
        return new Uint8Array();
      },
      async remove() {},
      async writeLiveDatabase(bytes) {
        writtenBytes = bytes;
      },
      async removeWalSiblings() {
        walRemoved = true;
      },
    };

    const valid = magicBytes();
    await replaceLiveDatabase(valid, fs);
    expect(writtenBytes).toBe(valid);
    expect(walRemoved).toBe(true);
  });

  it('throws on replaceLiveDatabase when snapshot is invalid', async () => {
    const fs: SnapshotFs = {
      scratchPath: '/cache/backup/gochao.db',
      liveDbPath: '/data/gochao.db',
      async vacuumInto() {},
      async readBytes() {
        return new Uint8Array();
      },
      async remove() {},
      async writeLiveDatabase() {},
      async removeWalSiblings() {},
    };

    await expect(replaceLiveDatabase(new Uint8Array(10), fs)).rejects.toThrow(
      'Downloaded backup is not a valid database.',
    );
  });
});

describe('isBackupConfigured', () => {
  it('returns true when client ID is non-empty', () => {
    expect(isBackupConfigured('client-123.apps.googleusercontent.com')).toBe(true);
  });

  it('returns false when client ID is blank or empty', () => {
    expect(isBackupConfigured('')).toBe(false);
    expect(isBackupConfigured('   ')).toBe(false);
  });
});
