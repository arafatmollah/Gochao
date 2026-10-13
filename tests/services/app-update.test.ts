import {
  compareVersions,
  fetchLatestRelease,
  isImportantRelease,
  pickApkAsset,
} from '@/services/app-update';

function releasePayload(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: 'v1.2.0',
    name: 'v1.2.0',
    body: 'Bug fixes and improvements.',
    published_at: '2026-10-01T00:00:00Z',
    assets: [
      { name: 'Gochao.apk', browser_download_url: 'https://example.com/Gochao.apk', size: 12345 },
    ],
    ...overrides,
  };
}

function stubFetch(payload: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(payload === undefined ? null : JSON.stringify(payload), {
      status,
    })) as typeof fetch;
}

describe('compareVersions', () => {
  it('orders dotted versions numerically', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('v1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });
});

describe('isImportantRelease', () => {
  it('flags the [important] marker in name or notes', () => {
    expect(isImportantRelease('v1.2.0 [important]', 'notes')).toBe(true);
    expect(isImportantRelease('v1.2.0', 'Please read [IMPORTANT] notes')).toBe(true);
    expect(isImportantRelease('v1.2.0', 'ordinary notes')).toBe(false);
  });
});

describe('pickApkAsset', () => {
  it('prefers the exact Gochao.apk asset, then any apk', () => {
    const exact = { name: 'Gochao.apk', browser_download_url: 'u1', size: 1 };
    const other = { name: 'other.apk', browser_download_url: 'u2', size: 2 };
    expect(pickApkAsset([other, exact])).toBe(exact);
    expect(pickApkAsset([other])).toBe(other);
    expect(pickApkAsset([{ name: 'notes.txt', browser_download_url: 'u', size: 1 }])).toBeNull();
    expect(pickApkAsset([])).toBeNull();
  });
});

describe('fetchLatestRelease', () => {
  it('parses the latest release with its apk asset', async () => {
    const result = await fetchLatestRelease(stubFetch(releasePayload()));

    expect(result).toEqual({
      ok: true,
      release: {
        tag: 'v1.2.0',
        version: '1.2.0',
        name: 'v1.2.0',
        notes: 'Bug fixes and improvements.',
        publishedAt: '2026-10-01T00:00:00Z',
        apkUrl: 'https://example.com/Gochao.apk',
        apkSize: 12345,
        important: false,
      },
    });
  });

  it('reports releases without an apk asset', async () => {
    const result = await fetchLatestRelease(stubFetch(releasePayload({ assets: [] })));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.release?.apkUrl).toBeNull();
    }
  });

  it('flags important releases', async () => {
    const result = await fetchLatestRelease(
      stubFetch(releasePayload({ body: 'Security fix [important].' })),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.release?.important).toBe(true);
    }
  });

  it('resolves null when no releases exist (404)', async () => {
    const result = await fetchLatestRelease(stubFetch(undefined, 404));

    expect(result).toEqual({ ok: true, release: null });
  });

  it('collapses transport failures to network', async () => {
    const failing = (async () => {
      throw new Error('offline');
    }) as typeof fetch;

    expect(await fetchLatestRelease(failing)).toEqual({ ok: false, reason: 'network' });
  });

  it('collapses bad statuses and bodies to server', async () => {
    expect(await fetchLatestRelease(stubFetch({}, 403))).toEqual({
      ok: false,
      reason: 'server',
    });
    expect(await fetchLatestRelease(stubFetch({ nope: true }))).toEqual({
      ok: false,
      reason: 'server',
    });
  });
});
