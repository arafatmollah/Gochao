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
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));
jest.mock('expo-device', () => ({
  brand: 'Google',
  modelName: 'Pixel 8',
  osName: 'Android',
  osVersion: '15',
}));

import { openBrowserAsync } from 'expo-web-browser';
import { setStringAsync } from 'expo-clipboard';
import FeedbackScreen from '@/app/feedback';

const mockOpenBrowser = openBrowserAsync as jest.Mock;
const mockSetString = setStringAsync as jest.Mock;

describe('FeedbackScreen', () => {
  beforeEach(() => {
    mockOpenBrowser.mockClear();
    mockOpenBrowser.mockResolvedValue({ type: 'dismiss' });
    mockSetString.mockClear();
    mockSetString.mockResolvedValue(true);
  });

  it('reviews the exact report before sharing', async () => {
    await render(<FeedbackScreen />);

    await fireEvent.changeText(
      screen.getByTestId('feedback-message-input'),
      'Prayer times are late',
    );

    // Review card shows the generated title and diagnostics.
    expect(screen.getByText('[Bug] Prayer times are late')).toBeTruthy();
    expect(screen.getByText(/App version:/)).toBeTruthy();
    expect(screen.getByText(/Device: Google Pixel 8/)).toBeTruthy();
  });

  it('submits via a prefilled GitHub issue', async () => {
    await render(<FeedbackScreen />);

    await fireEvent.changeText(screen.getByTestId('feedback-message-input'), 'Late times');
    await fireEvent.press(screen.getByTestId('feedback-submit-button'));

    expect(mockOpenBrowser).toHaveBeenCalledTimes(1);
    const url = mockOpenBrowser.mock.calls[0][0] as string;
    expect(url).toContain('github.com/arafatmollah/Gochao/issues/new?');
    expect(url).toContain('Late+times');
  });

  it('copies the report as a fallback', async () => {
    await render(<FeedbackScreen />);

    await fireEvent.changeText(screen.getByTestId('feedback-message-input'), 'Late times');
    await fireEvent.press(screen.getByTestId('feedback-copy-button'));

    expect(mockSetString).toHaveBeenCalledTimes(1);
    expect(mockSetString.mock.calls[0][0] as string).toContain('Late times');
  });

  it('hides diagnostics from the review when toggled off', async () => {
    await render(<FeedbackScreen />);

    await fireEvent.changeText(screen.getByTestId('feedback-message-input'), 'Late times');
    await fireEvent.press(screen.getByTestId('feedback-diagnostics-toggle'));

    expect(screen.queryByText(/App version:/)).toBeNull();
  });
});
