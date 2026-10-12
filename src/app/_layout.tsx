import { DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { DATABASE_NAME, initializeDatabase } from '@/db/database';
import { I18nProvider } from '@/i18n';
import { Colors, Spacing } from '@/theme/tokens';

/**
 * Foreground banner behavior + tap-to-open for prayer reminders. Native
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
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const url = response.notification.request.content.data?.url;
        if (typeof url === 'string' && url === '/prayer') {
          router.push('/prayer');
        }
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

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: Colors.primary,
        background: Colors.background,
        card: Colors.background,
        text: Colors.text,
        border: Colors.border,
      },
    }),
    [],
  );

  // The startup overlay hides only once the database AND the persisted
  // language preference are resolved, so a saved Bangla preference never
  // flashes the English shell. This screen is intentionally English: it runs
  // before the database (and thus the language preference) is available.
  const showOverlay = !dbReady || !i18nReady;

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="dark" />
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
              <DatabaseReady onReady={markDbReady} />
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: Colors.background },
                  headerTintColor: Colors.text,
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: Colors.background },
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
                <Stack.Screen name="health" />
                <Stack.Screen name="medicine-form" options={{ presentation: 'modal' }} />
                <Stack.Screen name="appointment-form" options={{ presentation: 'modal' }} />
                <Stack.Screen name="health-note-form" options={{ presentation: 'modal' }} />
                <Stack.Screen name="entertainment" />
                <Stack.Screen name="entertainment-form" options={{ presentation: 'modal' }} />
              </Stack>
            </I18nProvider>
          </SQLiteProvider>
          {showOverlay && (
            <View style={styles.overlay}>
              <LoadingState label="Opening Jibon…" />
            </View>
          )}
        </>
      )}
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
