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
jest.mock('@/features/entertainment/hooks/use-entertainment');

import EntertainmentScreen from '@/app/entertainment';
import { useEntertainment } from '@/features/entertainment/hooks/use-entertainment';

const mockUseEntertainment = useEntertainment as jest.Mock;

function baseHook(overrides: Record<string, unknown> = {}) {
  return {
    segment: 'discover',
    setSegment: jest.fn(),
    items: [],
    upcomingList: [],
    marvelList: [],
    forYouList: [],
    episodesList: [],
    forYouProvider: 'all',
    setForYouProvider: jest.fn(),
    upcoming: [],
    acclaimed: [],
    marvelFeed: [],
    trendingFeed: [],
    premiereFeed: [],
    loading: false,
    refreshing: false,
    error: null,
    notice: null,
    clearNotice: jest.fn(),
    search: '',
    setSearch: jest.fn(),
    statusFilter: 'all',
    setStatusFilter: jest.fn(),
    kindFilter: null,
    setKindFilter: jest.fn(),
    refresh: jest.fn(),
    saveSpotlight: jest.fn(),
    setStatus: jest.fn(),
    removeItem: jest.fn(),
    openLink: jest.fn(),
    apiKey: null,
    apiKeyInput: '',
    setApiKeyInput: jest.fn(),
    savingKey: false,
    saveApiKey: jest.fn(),
    lastSyncAt: null,
    syncing: false,
    syncError: null,
    syncNow: jest.fn(),
    ...overrides,
  };
}

const MARVEL = {
  id: 'tmdb-300',
  title: 'Vision Quest',
  kind: 'series',
  year: '2026',
  blurb: 'S1 E2 · TMDB 8.1',
  section: 'upcoming',
  saved: false,
} as const;

describe('EntertainmentScreen recommendations', () => {
  beforeEach(() => {
    mockUseEntertainment.mockReturnValue(baseHook());
  });

  it('asks for a TMDB key when recommendations are off', async () => {
    const saveApiKey = jest.fn();
    const setApiKeyInput = jest.fn();
    mockUseEntertainment.mockReturnValue(baseHook({ saveApiKey, setApiKeyInput }));
    await render(<EntertainmentScreen />);

    await fireEvent.changeText(screen.getByTestId('entertainment-api-key-input'), 'abc123');
    expect(setApiKeyInput).toHaveBeenCalledWith('abc123');

    await fireEvent.press(screen.getByTestId('entertainment-api-save'));
    expect(saveApiKey).toHaveBeenCalledTimes(1);
  });

  it('shows marvel and trending feed sections with add buttons', async () => {
    const saveSpotlight = jest.fn();
    const syncNow = jest.fn();
    mockUseEntertainment.mockReturnValue(
      baseHook({
        apiKey: 'key',
        marvelFeed: [MARVEL],
        trendingFeed: [],
        lastSyncAt: '2026-10-13T10:00:00.000Z',
        saveSpotlight,
        syncNow,
      }),
    );
    await render(<EntertainmentScreen />);

    expect(screen.getByText('Marvel premieres')).toBeTruthy();
    expect(screen.getByTestId('spotlight-tmdb-300')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('entertainment-sync-now'));
    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it('surfaces sync failures', async () => {
    mockUseEntertainment.mockReturnValue(
      baseHook({ apiKey: 'key', syncError: "Couldn't reach TMDB." }),
    );
    await render(<EntertainmentScreen />);

    expect(screen.getByText("Couldn't reach TMDB.")).toBeTruthy();
  });

  it('renders marvel universe section with phase badges and titles', async () => {
    mockUseEntertainment.mockReturnValue(
      baseHook({
        segment: 'marvel',
        marvelList: [
          {
            id: 'm-doomsday',
            title: 'Avengers: Doomsday',
            kind: 'movie',
            releaseDate: '2026-12-18',
            isMarvel: true,
            phase: 'Phase 6',
            voteAverage: 0,
            saved: false,
          },
        ],
      }),
    );
    await render(<EntertainmentScreen />);

    expect(screen.getByText('Avengers: Doomsday')).toBeTruthy();
    expect(screen.getByText('Phase 6')).toBeTruthy();
  });

  it('renders for you section with bangladesh streaming provider chips', async () => {
    const setForYouProvider = jest.fn();
    mockUseEntertainment.mockReturnValue(
      baseHook({
        segment: 'for_you',
        forYouProvider: 'netflix',
        setForYouProvider,
        forYouList: [
          {
            id: 'fy-1',
            title: 'Stranger Things',
            kind: 'series',
            providers: ['netflix'],
            watchRegion: 'BD',
            voteAverage: 8.7,
            saved: false,
          },
        ],
      }),
    );
    await render(<EntertainmentScreen />);

    expect(screen.getByText('Stranger Things')).toBeTruthy();
    expect(screen.getByTestId('for-you-provider-netflix')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('for-you-provider-prime'));
    expect(setForYouProvider).toHaveBeenCalledWith('prime');
  });

  it('renders episodes section with air dates', async () => {
    mockUseEntertainment.mockReturnValue(
      baseHook({
        segment: 'episodes',
        episodesList: [
          {
            id: 'ep-1',
            title: 'Daredevil',
            kind: 'series',
            episodeLabel: 'S1 E1 · Pilot',
            releaseDate: '2026-10-14',
            saved: false,
          },
        ],
      }),
    );
    await render(<EntertainmentScreen />);

    expect(screen.getByText('Daredevil')).toBeTruthy();
    expect(screen.getByText('S1 E1 · Pilot')).toBeTruthy();
  });
});
