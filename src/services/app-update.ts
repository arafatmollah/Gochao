/**
 * In-app update system: checks GitHub Releases for a newer APK, shows the
 * release notes, and downloads + installs the APK on Android.
 *
 * The CI workflow (`.github/workflows/build-apk.yml`) publishes every `v*`
 * tag as a GitHub Release with a `Gochao.apk` asset, so "latest" here means
 * the newest non-draft release on GitHub. Version comparison is a numeric
 * dot-part compare (`1.10.0` beats `1.9.0`); tags may carry a `v` prefix.
 *
 * Releases whose name or notes contain `[important]` are flagged so the UI
 * can raise a prominent banner and a best-effort local alert. True remote
 * push would need an EAS project plus a sending backend, which this app
 * does not have — there is deliberately no background polling either (the
 * privacy policy promises no unsolicited network traffic), so checks run
 * only when the user opens the update screen.
 *
 * Native seams (`ApkInstaller`) are injectable so tests never touch native
 * modules; the default adapters `require()` the Expo modules lazily so the
 * web bundle never evaluates them.
 */

export const GITHUB_OWNER = 'arafatmollah';
export const GITHUB_REPO = 'Gochao';
export const APK_ASSET_NAME = 'Gochao.apk';
export const APK_MIME_TYPE = 'application/vnd.android.package-archive';
/** Marker in a release name/notes that flags it as an important update. */
export const IMPORTANT_MARKER = '[important]';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface ReleaseInfo {
  /** Raw tag, e.g. `v1.2.0`. */
  tag: string;
  /** Normalized `X.Y.Z` version derived from the tag. */
  version: string;
  name: string;
  /** Release notes markdown as published on GitHub (may be empty). */
  notes: string;
  publishedAt: string | null;
  /** Direct APK download URL, or null when the release has no APK asset. */
  apkUrl: string | null;
  apkSize: number | null;
  important: boolean;
}

export type CheckResult =
  | { ok: true; release: ReleaseInfo | null }
  | { ok: false; reason: 'network' | 'server' };

/** Numeric dot-part compare: negative when `a` is older, positive when newer. */
export function compareVersions(a: string, b: string): number {
  const partsOf = (version: string): number[] =>
    version
      .trim()
      .replace(/^[vV]/, '')
      .split('.')
      .map((part) => {
        const match = /^(\d+)/.exec(part);
        return match ? Number(match[1]) : 0;
      });
  const left = partsOf(a);
  const right = partsOf(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** True when the release name or notes carry the `[important]` marker. */
export function isImportantRelease(name: string, body: string | null): boolean {
  const marker = IMPORTANT_MARKER.toLowerCase();
  return (
    name.toLowerCase().includes(marker) || (body ?? '').toLowerCase().includes(marker)
  );
}

/** Prefers the exact `Gochao.apk` asset, falls back to any `.apk` asset. */
export function pickApkAsset(assets: ReleaseAsset[]): ReleaseAsset | null {
  if (assets.length === 0) {
    return null;
  }
  const exact = assets.find((asset) => asset.name === APK_ASSET_NAME);
  if (exact) {
    return exact;
  }
  return assets.find((asset) => asset.name.toLowerCase().endsWith('.apk')) ?? null;
}

interface GithubReleaseResponse {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  draft?: boolean;
  assets?: ReleaseAsset[];
}

/**
 * Fetches the latest published GitHub Release. Resolves `null` when the
 * repository has no releases yet (HTTP 404). Never throws: transport
 * failures collapse to `network`, bad statuses to `server`.
 */
export async function fetchLatestRelease(
  fetchImpl: typeof fetch = fetch,
): Promise<CheckResult> {
  let response: Response;
  try {
    response = await fetchImpl(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (response.status === 404) {
    return { ok: true, release: null };
  }
  if (!response.ok) {
    return { ok: false, reason: 'server' };
  }
  let payload: GithubReleaseResponse;
  try {
    payload = (await response.json()) as GithubReleaseResponse;
  } catch {
    return { ok: false, reason: 'server' };
  }
  if (!payload || typeof payload.tag_name !== 'string') {
    return { ok: false, reason: 'server' };
  }
  const apk = pickApkAsset(Array.isArray(payload.assets) ? payload.assets : []);
  const name = payload.name ?? payload.tag_name;
  const body = payload.body ?? '';
  return {
    ok: true,
    release: {
      tag: payload.tag_name,
      version: payload.tag_name.trim().replace(/^[vV]/, ''),
      name,
      notes: body,
      publishedAt: payload.published_at,
      apkUrl: apk?.browser_download_url ?? null,
      apkSize: apk?.size ?? null,
      important: isImportantRelease(name, body),
    },
  };
}

export type DownloadProgressHandler = (written: number, total: number | null) => void;

export interface DownloadedApk {
  /** `file://` URI of the downloaded APK inside app storage. */
  fileUri: string;
}

/**
 * Native seam for APK download + install. Production uses the Expo download
 * task (with progress) and the package-installer intent; tests inject fakes.
 */
export interface ApkInstaller {
  download(url: string, onProgress: DownloadProgressHandler): Promise<DownloadedApk>;
  install(fileUri: string): Promise<void>;
}

function defaultApkInstaller(): ApkInstaller {
  // Lazy requires keep the web bundle free of native modules; these paths
  // only ever run on Android.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Directory, File, Paths } = require('expo-file-system');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const legacyFileSystem = require('expo-file-system/legacy');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const IntentLauncher = require('expo-intent-launcher');
  return {
    async download(url, onProgress) {
      const dir = new Directory(Paths.cache, 'updates');
      if (!dir.exists) {
        dir.create();
      }
      const destination = new File(dir, APK_ASSET_NAME);
      if (destination.exists) {
        destination.delete();
      }
      const task = File.createDownloadTask(url, destination, {
        onProgress: ({ bytesWritten, totalBytes }: { bytesWritten: number; totalBytes: number }) => {
          onProgress(bytesWritten, totalBytes > 0 ? totalBytes : null);
        },
      });
      try {
        const file = await task.downloadAsync();
        if (!file) {
          throw new Error('Download did not complete.');
        }
        return { fileUri: file.uri };
      } finally {
        task.release();
      }
    },
    async install(fileUri) {
      const contentUri: string = await legacyFileSystem.getContentUriAsync(fileUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        // FLAG_GRANT_READ_URI_PERMISSION: the installer may read our file.
        flags: 1,
        type: APK_MIME_TYPE,
      });
    },
  };
}

/** Downloads the APK with progress; throws on failure. Android only. */
export async function downloadApk(
  url: string,
  onProgress: DownloadProgressHandler,
  installer: ApkInstaller = defaultApkInstaller(),
): Promise<DownloadedApk> {
  return installer.download(url, onProgress);
}

/** Opens the system package installer for a downloaded APK. Android only. */
export async function installApk(
  fileUri: string,
  installer: ApkInstaller = defaultApkInstaller(),
): Promise<void> {
  await installer.install(fileUri);
}
