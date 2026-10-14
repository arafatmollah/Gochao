import { DRIVE_APPDATA_SCOPE, GOOGLE_WEB_CLIENT_ID } from './backup-config';

/**
 * Google Sign-In seam for Drive backup. Session tokens stay inside the
 * native Google SDK (never stored by us); only the account email is
 * persisted. The native module is `require()`d lazily so unit tests and the
 * web bundle never evaluate it.
 */

export interface GoogleAccount {
  email: string;
}

export interface GoogleAuth {
  configure(): void;
  signIn(): Promise<GoogleAccount>;
  signInSilently(): Promise<GoogleAccount | null>;
  signOut(): Promise<void>;
  getAccessToken(): Promise<string>;
}

function sdk(): {
  configure(options: Record<string, unknown>): void;
  signIn(): Promise<{ type: string; data?: { user?: { email?: string } } }>;
  signInSilently(): Promise<{ type: string; data?: { user?: { email?: string } } }>;
  signOut(): Promise<void>;
  getTokens(): Promise<{ accessToken?: string }>;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin').GoogleSignin;
}

function emailOf(response: { type: string; data?: { user?: { email?: string } } }): GoogleAccount {
  if (response.type !== 'success') {
    throw new Error('Google sign-in was cancelled.');
  }
  const email = response.data?.user?.email ?? '';
  if (email === '') {
    throw new Error('Google did not return an account email.');
  }
  return { email };
}

function defaultGoogleAuth(): GoogleAuth {
  return {
    configure() {
      sdk().configure({ scopes: [DRIVE_APPDATA_SCOPE], webClientId: GOOGLE_WEB_CLIENT_ID });
    },
    async signIn() {
      return emailOf(await sdk().signIn());
    },
    async signInSilently() {
      try {
        return emailOf(await sdk().signInSilently());
      } catch {
        return null;
      }
    },
    async signOut() {
      await sdk().signOut();
    },
    async getAccessToken() {
      const tokens = await sdk().getTokens();
      if (!tokens?.accessToken) {
        throw new Error('No Google access token.');
      }
      return tokens.accessToken;
    },
  };
}

export function createGoogleAuth(overrides: Partial<GoogleAuth> = {}): GoogleAuth {
  const base = defaultGoogleAuth();
  return { ...base, ...overrides };
}
