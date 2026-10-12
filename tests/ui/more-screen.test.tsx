import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router');

import { router } from 'expo-router';
import MoreScreen from '@/app/(tabs)/more';

const mockPush = router.push as jest.Mock;

describe('MoreScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('links to the live family module', async () => {
    await render(<MoreScreen />);

    expect(screen.getByTestId('more-family-entry')).toBeTruthy();
    expect(screen.getByText('Family & members')).toBeTruthy();
    expect(
      screen.getByText('Requests for your household, stored only on this device.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('more-family-entry'));
    expect(mockPush).toHaveBeenCalledWith('/family');
  });

  it('links to the live notes module', async () => {
    await render(<MoreScreen />);

    expect(screen.getByTestId('more-notes-entry')).toBeTruthy();
    expect(screen.getByText('Notes')).toBeTruthy();
    expect(
      screen.getByText('Plain-text notes — pin, tag, and search them offline.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('more-notes-entry'));
    expect(mockPush).toHaveBeenCalledWith('/notes');
  });

  it('links to the live grocery module', async () => {
    await render(<MoreScreen />);

    expect(screen.getByTestId('more-grocery-entry')).toBeTruthy();
    expect(screen.getByText('Grocery')).toBeTruthy();
    expect(
      screen.getByText('Shopping lists with quantities, prices, and history.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('more-grocery-entry'));
    expect(mockPush).toHaveBeenCalledWith('/grocery');
  });

  it('links to the live prayer module', async () => {
    await render(<MoreScreen />);

    expect(screen.getByTestId('more-prayer-entry')).toBeTruthy();
    expect(screen.getByText('Prayer')).toBeTruthy();
    expect(
      screen.getByText('Daily prayer times, tracking, and history — fully offline.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('more-prayer-entry'));
    expect(mockPush).toHaveBeenCalledWith('/prayer');
  });

  it('links to the live health module', async () => {
    await render(<MoreScreen />);

    expect(screen.getByTestId('more-health-entry')).toBeTruthy();
    expect(screen.getByText('Health & medicine')).toBeTruthy();
    expect(
      screen.getByText('Medicines, doses, visits, and notes — records only.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('more-health-entry'));
    expect(mockPush).toHaveBeenCalledWith('/health');
  });

  it('links to the live entertainment module', async () => {
    await render(<MoreScreen />);

    expect(screen.getByTestId('more-entertainment-entry')).toBeTruthy();
    expect(screen.getByText('Entertainment')).toBeTruthy();
    expect(
      screen.getByText('Movies, series & videos to watch.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('more-entertainment-entry'));
    expect(mockPush).toHaveBeenCalledWith('/entertainment');
  });

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
    expect(screen.getByText('Backup & restore')).toBeTruthy();
    expect(screen.getByText('Phase 9')).toBeTruthy();
    // The finance, notes, and family modules are live, so none are listed as upcoming.
    expect(screen.queryByText('Income & expenses')).toBeNull();
    expect(screen.queryByText('Phase 4')).toBeNull();
    // "Family & members" appears only as the live entry card, not in the roadmap.
    expect(screen.getAllByText('Family & members')).toHaveLength(1);
  });

  it('lets the user pick a language chip without crashing outside the provider', async () => {
    await render(<MoreScreen />);

    await fireEvent.press(screen.getByTestId('language-bn'));

    // The default context has no storage, so this stays a no-op render.
    expect(screen.getByTestId('language-bn')).toBeTruthy();
  });
});
