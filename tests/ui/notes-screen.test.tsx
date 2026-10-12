import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router');
jest.mock('@/features/notes/hooks/use-notes');

import { router } from 'expo-router';
import NotesScreen from '@/app/notes';
import { useNotes } from '@/features/notes/hooks/use-notes';

import { makeNote } from '../helpers/factories';

const mockPush = router.push as jest.Mock;
const mockUseNotes = useNotes as jest.Mock;

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    notes: [],
    categories: [],
    search: '',
    setSearch: jest.fn(),
    categoryId: null,
    setCategoryId: jest.fn(),
    loading: false,
    refreshing: false,
    error: null,
    notice: null,
    clearNotice: jest.fn(),
    refresh: jest.fn(),
    togglePin: jest.fn(),
    ...overrides,
  };
}

describe('NotesScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('lists notes with category, tags, and modified date', async () => {
    const note = makeNote({
      id: 'note-9',
      title: 'Rent receipts',
      content: 'Keep every receipt',
      categoryName: 'Home',
      tags: [{ id: 'tag-1', name: 'tax', createdAt: '2026-10-01T00:00:00.000Z' }],
      updatedAt: '2026-10-09T00:00:00.000Z',
    });
    mockUseNotes.mockReturnValue(baseHookState({ notes: [note] }));
    await render(<NotesScreen />);

    expect(screen.getByText('Rent receipts')).toBeTruthy();
    expect(screen.getByText('Keep every receipt')).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('#tax')).toBeTruthy();
    expect(screen.getByText(/Updated/)).toBeTruthy();
  });

  it('toggles the pin from the card and opens the form from card and FAB', async () => {
    const togglePin = jest.fn();
    const note = makeNote({ id: 'note-9', title: 'Rent receipts' });
    mockUseNotes.mockReturnValue(baseHookState({ notes: [note], togglePin }));
    await render(<NotesScreen />);

    await fireEvent.press(screen.getByTestId('note-card-note-9-pin'));
    expect(togglePin).toHaveBeenCalledWith(note);

    await fireEvent.press(screen.getByTestId('note-card-note-9'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/note-form', params: { id: 'note-9' } });

    await fireEvent.press(screen.getByTestId('add-note-fab'));
    expect(mockPush).toHaveBeenCalledWith('/note-form');
  });

  it('filters by search text and category chips', async () => {
    const setSearch = jest.fn();
    const setCategoryId = jest.fn();
    mockUseNotes.mockReturnValue(
      baseHookState({
        setSearch,
        setCategoryId,
        categories: [{ id: 'cat-1', name: 'Home', createdAt: '2026-10-01T00:00:00.000Z', noteCount: 2 }],
      }),
    );
    await render(<NotesScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('notes-search'), 'grocery');
    });
    expect(setSearch).toHaveBeenCalledWith('grocery');

    await fireEvent.press(screen.getByTestId('notes-category-cat-1'));
    expect(setCategoryId).toHaveBeenCalledWith('cat-1');
  });

  it('shows the plain empty state and the no-match state while filtering', async () => {
    mockUseNotes.mockReturnValue(baseHookState());
    const first = await render(<NotesScreen />);
    expect(screen.getByText('No notes yet')).toBeTruthy();
    first.unmount();

    mockUseNotes.mockReturnValue(baseHookState({ search: 'grocery' }));
    await render(<NotesScreen />);
    expect(screen.getByText('No matching notes')).toBeTruthy();
  });
});
