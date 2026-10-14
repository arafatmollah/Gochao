import { render, screen } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router');
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    withTiming: (toValue: unknown) => toValue,
    withRepeat: (value: unknown) => value,
  };
});
jest.mock('@/features/prayer/hooks/use-prayer-day');

import PrayerScreen from '@/app/prayer';
import { usePrayerDay } from '@/features/prayer/hooks/use-prayer-day';

const mockUsePrayerDay = usePrayerDay as jest.Mock;

function baseDay() {
  return {
    date: '2026-10-14',
    prayers: [
      { prayer: 'tahajjud', time: '00:00', status: null },
      { prayer: 'fajr', time: '04:39', status: 'prayed' },
      { prayer: 'dhuhr', time: '11:46', status: null },
      { prayer: 'asr', time: '15:57', status: null },
      { prayer: 'maghrib', time: '17:35', status: null },
      { prayer: 'isha', time: '18:50', status: null },
    ],
  };
}

function baseHook(overrides: Record<string, unknown> = {}) {
  return {
    date: '2026-10-14',
    day: baseDay(),
    next: { prayer: 'asr', time: '15:57', minutesLeft: 60 },
    current: { prayer: 'dhuhr', time: '11:46', endTime: '15:57' },
    prayedCount: 1,
    loading: false,
    refreshing: false,
    error: null,
    notice: null,
    clearNotice: jest.fn(),
    refresh: jest.fn(),
    cycleStatus: jest.fn(),
    ...overrides,
  };
}

describe('PrayerScreen', () => {
  beforeEach(() => {
    mockUsePrayerDay.mockReturnValue(baseHook());
  });

  it('lists all six prayers with Tahajjud first', async () => {
    await render(<PrayerScreen />);

    expect(screen.getByTestId('prayer-row-tahajjud')).toBeTruthy();
    expect(screen.getByText('Tahajjud')).toBeTruthy();
    expect(screen.getByText('12:00 AM – 4:39 AM')).toBeTruthy();
  });
});
