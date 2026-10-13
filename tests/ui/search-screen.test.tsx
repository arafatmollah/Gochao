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
jest.mock('@/features/search/hooks/use-saved-search');

import { router } from 'expo-router';
import SearchScreen from '@/app/search';
import { useSavedSearch } from '@/features/search/hooks/use-saved-search';

const mockPush = router.push as jest.Mock;
const mockUseSavedSearch = useSavedSearch as jest.Mock;

describe('SearchScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUseSavedSearch.mockReturnValue({ saved: [], recent: [] });
  });

  it('runs command actions from typed text', async () => {
    await render(<SearchScreen />);

    await fireEvent.changeText(screen.getByTestId('universal-search-field'), 'add');

    expect(screen.getByTestId('search-actions-header')).toBeTruthy();
    expect(screen.getByTestId('search-result-add-task')).toBeTruthy();
    expect(screen.getByTestId('search-result-add-income')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('search-result-add-income'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction-form',
      params: { kind: 'income' },
    });
  });

  it('finds features and settings by name', async () => {
    await render(<SearchScreen />);

    await fireEvent.changeText(screen.getByTestId('universal-search-field'), 'pray');

    expect(screen.getByTestId('search-result-go-prayer')).toBeTruthy();
    expect(screen.getByTestId('search-result-go-prayer-settings')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('search-result-go-prayer'));
    expect(mockPush).toHaveBeenCalledWith('/prayer');
  });

  it('shows saved items and opens them', async () => {
    mockUseSavedSearch.mockReturnValue({
      saved: [{ kind: 'task', id: 'task-1', title: 'Buy insulin', updatedAt: '2026-10-11T00:00:00Z' }],
      recent: [],
    });
    await render(<SearchScreen />);

    await fireEvent.changeText(screen.getByTestId('universal-search-field'), 'insulin');

    expect(screen.getByTestId('search-saved-header')).toBeTruthy();
    expect(screen.getByTestId('search-saved-task-task-1')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('search-saved-task-task-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/task-form', params: { id: 'task-1' } });
  });

  it('shows recent activity for an empty query', async () => {
    mockUseSavedSearch.mockReturnValue({
      saved: [],
      recent: [{ kind: 'note', id: 'note-1', title: 'Rent receipts', updatedAt: '2026-10-11T00:00:00Z' }],
    });
    await render(<SearchScreen />);

    expect(screen.getByTestId('search-recent-header')).toBeTruthy();
    expect(screen.getByTestId('search-recent-note-note-1')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('search-recent-note-note-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/note-form', params: { id: 'note-1' } });
  });

  it('reports no matches for unknown text', async () => {
    await render(<SearchScreen />);

    await fireEvent.changeText(screen.getByTestId('universal-search-field'), 'zzz-no-match');

    expect(screen.getByText(/No matches for/)).toBeTruthy();
    expect(screen.queryByTestId('search-actions-header')).toBeNull();
  });
});
