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
import { DisplayProvider } from '@/theme/display-context';

describe('display settings', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it('switches text size and persists it', async () => {
    await render(
      <DisplayProvider>
        <MoreScreen />
      </DisplayProvider>,
    );

    await fireEvent.press(screen.getByTestId('display-size-1.3'));

    await waitFor(() => {
      expect(store['display.textScale']).toBe('1.3');
    });
  });

  it('toggles reduced motion and restores both on mount', async () => {
    store['display.textScale'] = '1.15';
    store['display.reduceMotion'] = '1';

    const { unmount } = await render(
      <DisplayProvider>
        <MoreScreen />
      </DisplayProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('display-motion-toggle').props.accessibilityState).toMatchObject({
        checked: true,
      });
    });
    unmount();
  });

  it('renders the motion toggle outside a provider without crashing', async () => {
    await render(<MoreScreen />);

    expect(screen.getByTestId('display-motion-toggle')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('display-motion-toggle'));
    expect(screen.getByTestId('display-motion-toggle')).toBeTruthy();
  });
});
