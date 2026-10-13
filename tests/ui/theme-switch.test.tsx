import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router');

const store: Record<string, string> = {};
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => ({
    getFirstAsync: async (_sql: string, params: unknown[]) => {
      const value = store[params[0] as string] ?? null;
      return value === null ? null : { value };
    },
    runAsync: async (_sql: string, params: unknown[]) => {
      store[params[0] as string] = params[1] as string;
      return { lastInsertRowId: 0, changes: 1 };
    },
  }),
}));

import MoreScreen from '@/app/(tabs)/more';
import { AppThemeProvider } from '@/theme/theme-context';

describe('theme switching', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it('applies the tapped theme instantly and persists it', async () => {
    await render(
      <AppThemeProvider>
        <MoreScreen />
      </AppThemeProvider>,
    );

    expect(screen.getByTestId('theme-option-default').props.accessibilityState).toMatchObject({
      checked: true,
    });

    await fireEvent.press(screen.getByTestId('theme-option-dark'));

    await waitFor(() => {
      expect(screen.getByTestId('theme-option-dark').props.accessibilityState).toMatchObject({
        checked: true,
      });
    });
    expect(screen.getByTestId('theme-option-default').props.accessibilityState).toMatchObject({
      checked: false,
    });
    expect(store.theme).toBe('dark');
  });

  it('restores the stored theme on mount', async () => {
    store.theme = 'loki';

    await render(
      <AppThemeProvider>
        <MoreScreen />
      </AppThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-option-loki').props.accessibilityState).toMatchObject({
        checked: true,
      });
    });
  });
});
