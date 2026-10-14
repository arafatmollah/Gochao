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
import WhatsNewScreen from '@/app/whats-new';

const mockPush = router.push as jest.Mock;

describe('WhatsNewScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('shows the current version highlights with history and close actions', async () => {
    await render(<WhatsNewScreen />);

    expect(screen.getByTestId('whats-new-header')).toBeTruthy();
    expect(screen.getByTestId('whats-new-entry')).toBeTruthy();
    expect(screen.getByText('1.0.0')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('whats-new-history-button'));
    expect(mockPush).toHaveBeenCalledWith('/about-version-history');
  });
});
