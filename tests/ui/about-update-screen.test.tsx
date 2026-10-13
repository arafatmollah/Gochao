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

import AboutUpdateScreen from '@/app/about-update';

function releasePayload(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: 'v1.1.0',
    name: 'v1.1.0',
    body: 'Faster prayer times.',
    published_at: '2026-10-01T00:00:00Z',
    assets: [
      { name: 'Gochao.apk', browser_download_url: 'https://example.com/Gochao.apk', size: 1 },
    ],
    ...overrides,
  };
}

function stubFetch(payload: unknown, status = 200) {
  return jest.fn(async () => new Response(JSON.stringify(payload), { status }));
}

describe('AboutUpdateScreen', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('shows release notes when a newer release exists', async () => {
    global.fetch = stubFetch(releasePayload());
    await render(<AboutUpdateScreen />);

    // Current version in tests is 1.0.0, so v1.1.0 is an update.
    expect(await screen.findByTestId('update-available-card')).toBeTruthy();
    expect(screen.getByText('Update available: 1.1.0')).toBeTruthy();
    expect(screen.getByText('Faster prayer times.')).toBeTruthy();
  });

  it('reports when already on the latest version', async () => {
    global.fetch = stubFetch(releasePayload({ tag_name: 'v1.0.0', name: 'v1.0.0' }));
    await render(<AboutUpdateScreen />);

    expect(await screen.findByTestId('update-up-to-date')).toBeTruthy();
    expect(screen.queryByTestId('update-available-card')).toBeNull();
  });

  it('shows an error when the check fails and retries', async () => {
    const failing = jest.fn(async () => {
      throw new Error('offline');
    });
    global.fetch = failing;
    await render(<AboutUpdateScreen />);

    expect(await screen.findByText(/Could not reach GitHub/)).toBeTruthy();

    global.fetch = stubFetch(releasePayload({ tag_name: 'v1.0.0', name: 'v1.0.0' }));
    await fireEvent.press(screen.getByTestId('update-check-button'));
    expect(await screen.findByTestId('update-up-to-date')).toBeTruthy();
    expect(failing).toHaveBeenCalledTimes(1);
  });
});
