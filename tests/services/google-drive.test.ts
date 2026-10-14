import {
  downloadBackupFile,
  findBackupFile,
  uploadBackupFile,
} from '@/services/google-drive';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return ((url: string, init?: RequestInit) => Promise.resolve(handler(url, init))) as typeof fetch;
}

describe('findBackupFile', () => {
  it('returns the stored backup file', async () => {
    const fetchImpl = stubFetch(() =>
      jsonResponse({ files: [{ id: 'file-1', modifiedTime: '2026-10-13T00:00:00Z', size: 42 }] }),
    );

    const result = await findBackupFile(fetchImpl, 'token');
    expect(result).toEqual({
      file: { id: 'file-1', modifiedTime: '2026-10-13T00:00:00Z', size: 42 },
    });
  });

  it('returns null when never backed up', async () => {
    const fetchImpl = stubFetch(() => jsonResponse({ files: [] }));

    expect(await findBackupFile(fetchImpl, 'token')).toEqual({ file: null });
  });

  it('maps expired tokens to auth and transport failures to network', async () => {
    expect(await findBackupFile(stubFetch(() => jsonResponse({}, 401)), 'token')).toEqual({
      error: 'auth',
    });
    const failing = ((_url: string) => Promise.reject(new Error('offline'))) as typeof fetch;
    expect(await findBackupFile(failing, 'token')).toEqual({ error: 'network' });
  });
});

describe('uploadBackupFile', () => {
  const bytes = new Uint8Array([1, 2, 3]);

  it('creates a new file with multipart metadata', async () => {
    let seenUrl = '';
    let seenMethod = '';
    const fetchImpl = stubFetch((url, init) => {
      seenUrl = url;
      seenMethod = init?.method ?? '';
      return jsonResponse({ id: 'new-id' });
    });

    const result = await uploadBackupFile(fetchImpl, 'token', bytes, null);

    expect(result).toEqual({ id: 'new-id' });
    expect(seenUrl).toContain('/upload/drive/v3/files?uploadType=multipart');
    expect(seenMethod).toBe('POST');
  });

  it('patches the known file id on later backups', async () => {
    let seenUrl = '';
    let seenMethod = '';
    const fetchImpl = stubFetch((url, init) => {
      seenUrl = url;
      seenMethod = init?.method ?? '';
      return jsonResponse({ id: 'file-1' });
    });

    const result = await uploadBackupFile(fetchImpl, 'token', bytes, 'file-1');

    expect(result).toEqual({ id: 'file-1' });
    expect(seenUrl).toContain('/upload/drive/v3/files/file-1');
    expect(seenMethod).toBe('PATCH');
  });

  it('collapses failures', async () => {
    expect(await uploadBackupFile(stubFetch(() => jsonResponse({}, 500)), 't', bytes, null)).toEqual({
      error: 'server',
    });
    expect(await uploadBackupFile(stubFetch(() => jsonResponse({})), 't', bytes, null)).toEqual({
      error: 'server',
    });
  });
});

describe('downloadBackupFile', () => {
  it('returns raw bytes', async () => {
    const fetchImpl = stubFetch(
      () => new Response(new Uint8Array([9, 9]).buffer as ArrayBuffer),
    );

    const result = await downloadBackupFile(fetchImpl, 'token', 'file-1');
    expect(result.bytes).toEqual(new Uint8Array([9, 9]));
  });

  it('maps missing files to server and offline to network', async () => {
    expect(await downloadBackupFile(stubFetch(() => jsonResponse({}, 404)), 't', 'x')).toEqual({
      error: 'server',
    });
    const failing = ((_url: string) => Promise.reject(new Error('offline'))) as typeof fetch;
    expect(await downloadBackupFile(failing, 't', 'x')).toEqual({ error: 'network' });
  });
});
