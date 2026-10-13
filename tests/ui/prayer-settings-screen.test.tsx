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
jest.mock('@/features/prayer/hooks/use-prayer-settings');

import PrayerSettingsScreen from '@/app/prayer-settings';
import { usePrayerSettings } from '@/features/prayer/hooks/use-prayer-settings';

const mockUsePrayerSettings = usePrayerSettings as jest.Mock;

function baseForm(overrides: Record<string, unknown> = {}) {
  return {
    loadState: 'ready',
    loadError: null,
    retryLoad: jest.fn(),
    method: 'karachi',
    setMethod: jest.fn(),
    madhab: 'hanafi',
    setMadhab: jest.fn(),
    city: '',
    setCity: jest.fn(),
    cityError: null,
    latitudeText: '',
    setLatitudeText: jest.fn(),
    latitudeError: null,
    longitudeText: '',
    setLongitudeText: jest.fn(),
    longitudeError: null,
    utcOffsetText: '+6',
    setUtcOffsetText: jest.fn(),
    utcOffsetError: null,
    adjustTexts: { fajr: '0', dhuhr: '0', asr: '0', maghrib: '0', isha: '0' },
    setAdjustText: jest.fn(),
    adjustError: null,
    formError: null,
    saving: false,
    submit: jest.fn(),
    remindersEnabled: false,
    togglingReminders: false,
    remindersError: null,
    toggleReminders: jest.fn(),
    testingNotification: false,
    testNotice: null,
    clearTestNotice: jest.fn(),
    sendTestNotification: jest.fn(),
    locating: false,
    locateError: null,
    detectLocation: jest.fn(),
    ...overrides,
  };
}

describe('PrayerSettingsScreen test notification', () => {
  beforeEach(() => {
    mockUsePrayerSettings.mockReturnValue(baseForm());
  });

  it('fires a test notification from the button', async () => {
    const sendTestNotification = jest.fn();
    mockUsePrayerSettings.mockReturnValue(baseForm({ sendTestNotification }));
    await render(<PrayerSettingsScreen />);

    await fireEvent.press(screen.getByTestId('prayer-test-notification-button'));
    expect(sendTestNotification).toHaveBeenCalledTimes(1);
  });

  it('shows the sent confirmation and dismisses it', async () => {
    const clearTestNotice = jest.fn();
    mockUsePrayerSettings.mockReturnValue(
      baseForm({ testNotice: 'Test sent.', clearTestNotice }),
    );
    await render(<PrayerSettingsScreen />);

    expect(screen.getByText('Test sent.')).toBeTruthy();
  });
});
