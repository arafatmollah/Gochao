import { act, fireEvent, render, screen } from '@testing-library/react-native';

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
  });

  it('dismisses the native splash on layout so the reveal animation is visible', async () => {
    await render(<AnimatedSplash shouldHide={false} onHidden={jest.fn()} />);

    expect(mockHideAsync).not.toHaveBeenCalled();

    fireEvent(screen.getByTestId('splash-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 812 } },
    });
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('waits for the letter cascade, then reports once after the exit fade', async () => {
    jest.useFakeTimers();
    try {
      const onHidden = jest.fn();
      await render(<AnimatedSplash shouldHide onHidden={onHidden} />);

      // Mid-cascade: the view is still held.
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(onHidden).not.toHaveBeenCalled();

      // Past the sequence (1950ms): the exit fade is now scheduled.
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(onHidden).not.toHaveBeenCalled();
      // Past the exit fade (450ms): the shell is notified.
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(onHidden).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
