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
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

import { openBrowserAsync } from 'expo-web-browser';
import { router } from 'expo-router';
import AboutScreen, { CONTACT_URL } from '@/app/about';
import AboutPrivacyScreen from '@/app/about-privacy';
import AboutTermsScreen from '@/app/about-terms';
import AboutVersionHistoryScreen from '@/app/about-version-history';

const mockPush = router.push as jest.Mock;
const mockOpenBrowser = openBrowserAsync as jest.Mock;

describe('AboutScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockOpenBrowser.mockClear();
    mockOpenBrowser.mockResolvedValue({ type: 'dismiss' });
  });

  it('links to version history, terms, and privacy', async () => {
    await render(<AboutScreen />);

    expect(screen.getByTestId('about-version-entry')).toBeTruthy();
    expect(screen.getByText('Version History')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('about-version-entry'));
    expect(mockPush).toHaveBeenCalledWith('/about-version-history');

    await fireEvent.press(screen.getByTestId('about-terms-entry'));
    expect(mockPush).toHaveBeenCalledWith('/about-terms');

    await fireEvent.press(screen.getByTestId('about-privacy-entry'));
    expect(mockPush).toHaveBeenCalledWith('/about-privacy');
  });

  it('opens the developer contact link in a browser', async () => {
    await render(<AboutScreen />);

    expect(CONTACT_URL).toMatch(/^https:\/\//);
    await fireEvent.press(screen.getByTestId('about-contact-entry'));
    expect(mockOpenBrowser).toHaveBeenCalledWith(CONTACT_URL);
  });

  it('shows a message when the contact link fails', async () => {
    mockOpenBrowser.mockRejectedValue(new Error('no browser'));
    await render(<AboutScreen />);

    await fireEvent.press(screen.getByTestId('about-contact-entry'));
    expect(screen.getByText('Could not open the link.')).toBeTruthy();
  });
});

describe('AboutVersionHistoryScreen', () => {
  it('shows the current version and highlights', async () => {
    await render(<AboutVersionHistoryScreen />);

    expect(screen.getByTestId('about-version-header')).toBeTruthy();
    // Header kicker and version badge show the same text.
    expect(screen.getAllByText(/Version \d/)).toHaveLength(2);
    expect(screen.getByText('1.0.0')).toBeTruthy();
    expect(screen.getByText(/Tasks, bills, finance/)).toBeTruthy();
  });
});

describe('AboutTermsScreen', () => {
  it('renders the terms body', async () => {
    await render(<AboutTermsScreen />);

    expect(screen.getByTestId('about-terms-header')).toBeTruthy();
    expect(screen.getByText(/no accounts, no cloud sync/)).toBeTruthy();
  });
});

describe('AboutPrivacyScreen', () => {
  it('renders the privacy body', async () => {
    await render(<AboutPrivacyScreen />);

    expect(screen.getByTestId('about-privacy-header')).toBeTruthy();
    expect(screen.getByText(/works fully offline/)).toBeTruthy();
  });
});
