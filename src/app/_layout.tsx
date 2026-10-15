import { DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/error-state';
import { AnimatedSplash } from '@/components/animated-splash';
import { NotificationBootstrap } from '@/components/notification-bootstrap';
import { BackupBootstrap } from '@/components/backup-bootstrap';
import { EntertainmentBootstrap } from '@/components/entertainment-bootstrap';
import { DATABASE_NAME, initializeDatabase } from '@/db/database';
import { SqliteSettingsRepository, VERSION_SEEN_KEY } from '@/db/repositories/settings-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { I18nProvider } from '@/i18n';
import { compareVersions } from '@/services/app-update';
import { Colors, Spacing } from '@/theme/tokens';
import { AppThemeProvider, useAppTheme } from '@/theme/theme-context';
import { DisplayProvider } from '@/theme/display-context';
import { THEME_STATUS_BAR } from '@/theme/themes';

// The native launch image stays up until the animated splash takes over
// and dismisses it after its exit fade (safe to call on web too).
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash control unavailable: the app still starts behind the overlay.
});

function navigateToNotificationUrl(url?: unknown) {
  if (url === '/prayer') {
    router.push('/prayer');
  } else if (url === '/tasks') {
    router.push('/tasks');
  } else if (url === '/about-update') {
    router.push('/about-update');
  } else if (url === '/') {
    router.push('/');
  }
}

/**
 * Foreground banner behavior + tap-to-open for reminders. Native
 * only: `expo-notifications` has no web implementation, so the module is
 * dynamically imported behind a platform check and the web bundle never
 * evaluates it.
 */
function useNotificationObserver() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    let subscription: { remove: () => void } | undefined;
    void import('expo-notifications').then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      // Handle notification tap that launched the app from a killed state
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) {
          navigateToNotificationUrl(response.notification.request.content.data?.url);
        }
      });

      // Handle notification tap received while the app is active / backgrounded
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        navigateToNotificationUrl(response.notification.request.content.data?.url);
      });
    }).catch(() => {
      // Notifications unavailable: the app works fully without them.
    });
    return () => {
      subscription?.remove();
    };
  }, []);
}

/**
 * Rendered inside `SQLiteProvider`, which mounts children only after the
 * database opened and `onInit` finished — so the first mount means the
 * database is ready.
 */
function DatabaseReady({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

export default function RootLayout() {
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState(false);
  const [i18nReady, setI18nReady] = useState(false);
  const [initAttempt, setInitAttempt] = useState(0);
  const [splashDone, setSplashDone] = useState(false);
  useNotificationObserver();

  const markDbReady = useCallback(() => setDbReady(true), []);
  const markI18nReady = useCallback(() => setI18nReady(true), []);

  // SQLiteProvider reports open/init failures by calling `onError` during
  // render, so the state update is deferred out of the render phase.
  const reportDbError = useCallback((error: Error) => {
    queueMicrotask(() => setDbError(error.message));
  }, []);

  const retryInit = useCallback(() => {
    setDbError(null);
    setDbReady(false);
    setI18nReady(false);
    setInitAttempt((attempt) => attempt + 1);
  }, []);

  // The startup overlay hides only once the database AND the persisted
  // language preference are resolved, so a saved Bangla preference never
  // flashes the English shell. This screen is intentionally English: it runs
  // before the database (and thus the language preference) is available.
  const showOverlay = !dbReady || !i18nReady;
  const hideSplash = useCallback(() => setSplashDone(true), []);

  return (
    <>
      {dbError ? (
        <View style={styles.center}>
          <ErrorState
            title="Could not open your data"
            message={dbError}
            onRetry={retryInit}
            retryLabel="Try again"
          />
        </View>
      ) : (
        <>
          <SQLiteProvider
            key={initAttempt}
            databaseName={DATABASE_NAME}
            onInit={initializeDatabase}
            onError={reportDbError}>
            <I18nProvider onReady={markI18nReady}>
              <AppThemeProvider>
                <DisplayProvider>
                  <DatabaseReady onReady={markDbReady} />
                  <NotificationBootstrap />
                  <BackupBootstrap />
                  <EntertainmentBootstrap />
                  <ThemedShell />
                </DisplayProvider>
              </AppThemeProvider>
            </I18nProvider>
          </SQLiteProvider>
          {!splashDone && (
            <View style={styles.overlay}>
              <AnimatedSplash
                shouldHide={!showOverlay || dbError !== null}
                onHidden={hideSplash}
              />
            </View>
          )}
        </>
      )}
    </>
  );
}

/**
 * Everything that reads the active palette lives here, under the theme
 * provider: the navigation theme, the status bar, and the route stack.
 */
function ThemedShell() {
  const { colors, theme } = useAppTheme();
  const db = useSQLiteContext();
  const versionGateRun = useRef(false);

  // Shows What's New once per version upgrade (fresh installs just record
  // the version silently).
  useEffect(() => {
    if (versionGateRun.current) {
      return;
    }
    versionGateRun.current = true;
    void (async () => {
      try {
        const repo = new SqliteSettingsRepository(toSqlDatabase(db));
        const current = Constants.expoConfig?.version ?? '1.0.0';
        const seen = await repo.get(VERSION_SEEN_KEY);
        if (seen === null) {
          await repo.set(VERSION_SEEN_KEY, current);
          return;
        }
        if (compareVersions(current, seen) > 0) {
          await repo.set(VERSION_SEEN_KEY, current);
          router.push('/whats-new');
        }
      } catch {
        // Version notes must never break app start.
      }
    })();
  }, [db]);

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
      },
    }),
    [colors],
  );

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={THEME_STATUS_BAR[theme]} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="family" options={{ headerShown: false }} />
        <Stack.Screen name="health" options={{ headerShown: false }} />
        <Stack.Screen name="task-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="bill-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="bill-pay" options={{ presentation: 'modal' }} />
        <Stack.Screen name="bill-detail" />
        <Stack.Screen name="finance-accounts" />
        <Stack.Screen name="account-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="finance-transactions" />
        <Stack.Screen name="transaction-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="finance-transfer" options={{ presentation: 'modal' }} />
        <Stack.Screen name="finance-budgets" />
        <Stack.Screen name="budget-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="finance-reports" />
        <Stack.Screen name="finance-categories" />
        <Stack.Screen name="category-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="grocery" />
        <Stack.Screen name="grocery-detail" />
        <Stack.Screen name="grocery-list-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="grocery-item-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="prayer" />
        <Stack.Screen name="prayer-settings" />
        <Stack.Screen name="prayer-history" />
        <Stack.Screen name="medicine-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="appointment-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="health-note-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="entertainment" />
        <Stack.Screen name="entertainment-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="about" options={{ headerShown: false }} />
        <Stack.Screen name="backup" options={{ headerShown: false }} />
        <Stack.Screen name="feedback" options={{ headerShown: false }} />
        <Stack.Screen name="about-update" options={{ headerShown: false }} />
        <Stack.Screen name="whats-new" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="about-version-history" options={{ headerShown: false }} />
        <Stack.Screen name="about-terms" options={{ headerShown: false }} />
        <Stack.Screen name="about-privacy" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
});
