import { act, render, screen } from '@testing-library/react-native';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chainable = {
    duration: () => chainable,
    delay: () => chainable,
  };
  return {
    __esModule: true,
    default: { View },
    FadeIn: chainable,
    FadeInUp: chainable,
    FadeOut: chainable,
    ZoomIn: chainable,
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    withDelay: (_delay: number, value: unknown) => value,
    withSpring: (toValue: unknown) => toValue,
    withTiming: (toValue: unknown) => toValue,
  };
});

import * as SplashScreen from 'expo-splash-screen';
import { AnimatedSplash } from '@/components/animated-splash';

const mockHideAsync = SplashScreen.hideAsync as jest.Mock;

describe('AnimatedSplash', () => {
  beforeEach(() => {
    mockHideAsync.mockClear();
    jest.useRealTimers();
  });

  it('shows the brand mark and one letter per wordmark character while waiting', async () => {
    await render(<AnimatedSplash shouldHide={false} onHidden={jest.fn()} />);

    expect(screen.getByTestId('splash-screen')).toBeTruthy();
    expect(screen.getByTestId('splash-mark')).toBeTruthy();
    expect(screen.getByTestId('splash-name')).toBeTruthy();
    for (const [index, char] of ['G', 'O', 'C', 'H', 'A', 'O'].entries()) {
      expect(screen.getByTestId(`splash-letter-${index}`)).toBeTruthy();
      expect(screen.getByTestId(`splash-letter-${index}`).props.children).toBe(char);
    }
    expect(mockHideAsync).not.toHaveBeenCalled();
  });

  it('waits for the letter cascade, then hides the native splash and reports', async () => {
    jest.useFakeTimers();
    try {
      const onHidden = jest.fn();
      await render(<AnimatedSplash shouldHide onHidden={onHidden} />);

      // Mid-cascade: nothing hidden yet.
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockHideAsync).not.toHaveBeenCalled();
      expect(onHidden).not.toHaveBeenCalled();

      // Past the sequence (1950ms): the exit fade is now scheduled.
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(mockHideAsync).not.toHaveBeenCalled();
      // Past the exit fade (450ms): native splash hidden, shell notified.
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(mockHideAsync).toHaveBeenCalledTimes(1);
      expect(onHidden).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
