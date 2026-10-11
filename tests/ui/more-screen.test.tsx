import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

import MoreScreen from '@/app/(tabs)/more';

describe('MoreScreen', () => {
  it('groups language, about and roadmap content', async () => {
    await render(<MoreScreen />);

    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByTestId('language-en')).toBeTruthy();
    expect(screen.getByTestId('language-bn')).toBeTruthy();

    expect(screen.getByText('About Jibon')).toBeTruthy();
    expect(screen.getByText(/Version \d/)).toBeTruthy();
    expect(screen.getByText('Fully offline — your data stays on this device.')).toBeTruthy();
    expect(
      screen.getByText(
        'PIN lock and database encryption are not enabled yet — planned for a later phase.',
      ),
    ).toBeTruthy();

    expect(screen.getByText('Coming later')).toBeTruthy();
    expect(screen.getByText('Notes')).toBeTruthy();
    expect(screen.getByText('Phase 4')).toBeTruthy();
    expect(screen.getByText('Backup & restore')).toBeTruthy();
    expect(screen.getByText('Phase 9')).toBeTruthy();
    // The finance module is live, so it must no longer be listed as upcoming.
    expect(screen.queryByText('Income & expenses')).toBeNull();
  });

  it('lets the user pick a language chip without crashing outside the provider', async () => {
    await render(<MoreScreen />);

    await fireEvent.press(screen.getByTestId('language-bn'));

    // The default context has no storage, so this stays a no-op render.
    expect(screen.getByTestId('language-bn')).toBeTruthy();
  });
});
