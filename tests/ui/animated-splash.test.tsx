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

  it('shows the brand mark and wordmark while waiting', async () => {
    await render(<AnimatedSplash shouldHide={false} onHidden={jest.fn()} />);

    expect(screen.getByTestId('splash-screen')).toBeTruthy();
    expect(screen.getByTestId('splash-mark')).toBeTruthy();
    expect(screen.getByTestId('splash-name')).toBeTruthy();
    expect(mockHideAsync).not.toHaveBeenCalled();
  });

  it('hides the native splash and reports once it should hide', async () => {
    jest.useFakeTimers();
    try {
      const onHidden = jest.fn();
      await render(<AnimatedSplash shouldHide onHidden={onHidden} />);

      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      expect(mockHideAsync).toHaveBeenCalledTimes(1);
      expect(onHidden).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
