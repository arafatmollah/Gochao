import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  Stack: { Screen: () => null },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@/components/confirm', () => ({
  confirmDestructive: jest.fn(),
}));

jest.mock('@/features/notes/hooks/use-note-form');

import { router, useLocalSearchParams } from 'expo-router';
import NoteFormScreen from '@/app/note-form';
import { confirmDestructive } from '@/components/confirm';
import { useNoteForm } from '@/features/notes/hooks/use-note-form';

const mockRouter = router as unknown as { back: jest.Mock };
const mockUseNoteForm = useNoteForm as jest.Mock;
const mockConfirmDestructive = confirmDestructive as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;

const CATEGORY = {
  id: 'cat-1',
  name: 'Home',
  createdAt: '2026-10-01T00:00:00.000Z',
  noteCount: 2,
};
const TAG = { id: 'tag-1', name: 'tax', createdAt: '2026-10-01T00:00:00.000Z' };

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'new',
    loading: false,
    loadError: null,
    title: '',
    setTitle: jest.fn(),
    content: '',
    setContent: jest.fn(),
    categoryId: null,
    setCategoryId: jest.fn(),
    categories: [],
    newCategoryName: '',
    setNewCategoryName: jest.fn(),
    addCategory: jest.fn().mockResolvedValue(undefined),
    existingTags: [],
    selectedTagNames: [],
    toggleTagName: jest.fn(),
    newTagName: '',
    setNewTagName: jest.fn(),
    addNewTag: jest.fn(),
    pinned: false,
    setPinned: jest.fn(),
    saving: false,
    notice: null,
    clearNotice: jest.fn(),
    createdAt: null,
    updatedAt: null,
    save: jest.fn().mockResolvedValue(true),
    remove: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('NoteFormScreen', () => {
  beforeEach(() => {
    mockRouter.back.mockClear();
    mockConfirmDestructive.mockReset();
    mockParams.mockReturnValue({});
  });

  it('offers title, note text, category, tags and pin controls for a new note', async () => {
    mockUseNoteForm.mockReturnValue(baseHookState({ categories: [CATEGORY], existingTags: [TAG] }));
    await render(<NoteFormScreen />);

    expect(screen.getByTestId('note-title-input')).toBeTruthy();
    expect(screen.getByTestId('note-content-input')).toBeTruthy();
    expect(screen.getByTestId('note-category-none')).toBeTruthy();
    expect(screen.getByTestId('note-category-cat-1')).toBeTruthy();
    expect(screen.getByTestId('note-tag-tag-1')).toBeTruthy();
    expect(screen.getByTestId('note-tag-input')).toBeTruthy();
    expect(screen.getByTestId('note-pin-toggle')).toBeTruthy();
    expect(screen.getByTestId('note-save-button')).toBeTruthy();

    // A new note has nothing to delete and no stored timestamps yet.
    expect(screen.queryByTestId('note-delete-button')).toBeNull();
    expect(screen.queryByText(/Created/)).toBeNull();
  });

  it('saves and goes back when the note is stored', async () => {
    const save = jest.fn().mockResolvedValue(true);
    mockUseNoteForm.mockReturnValue(baseHookState({ save }));
    await render(<NoteFormScreen />);

    await fireEvent.press(screen.getByTestId('note-save-button'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('keeps the draft on screen and surfaces the reason when saving fails', async () => {
    const save = jest.fn().mockResolvedValue(false);
    mockUseNoteForm.mockReturnValue(
      baseHookState({ save, notice: 'Add a title or some note text.' }),
    );
    await render(<NoteFormScreen />);

    await fireEvent.press(screen.getByTestId('note-save-button'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(screen.getByTestId('note-form-notice')).toBeTruthy();
    expect(screen.getByText('Add a title or some note text.')).toBeTruthy();
  });

  it('shows a loading state instead of an empty form while an existing note loads', async () => {
    mockParams.mockReturnValue({ id: 'note-1' });
    mockUseNoteForm.mockReturnValue(baseHookState({ mode: 'edit', loading: true }));
    await render(<NoteFormScreen />);

    expect(screen.queryByTestId('note-title-input')).toBeNull();
    expect(screen.queryByTestId('note-save-button')).toBeNull();
  });

  it('shows a dismissible error and no form when the note could not be loaded', async () => {
    mockParams.mockReturnValue({ id: 'note-missing' });
    mockUseNoteForm.mockReturnValue(
      baseHookState({ mode: 'edit', loadError: 'That note no longer exists.' }),
    );
    await render(<NoteFormScreen />);

    expect(screen.getByText('That note no longer exists.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('loads the stored note with its created and modified dates', async () => {
    mockParams.mockReturnValue({ id: 'note-1' });
    mockUseNoteForm.mockReturnValue(
      baseHookState({
        mode: 'edit',
        title: 'Rent receipts',
        content: 'Keep every receipt',
        categoryId: 'cat-1',
        categories: [CATEGORY],
        existingTags: [TAG],
        selectedTagNames: ['tax', 'receipt'],
        pinned: true,
        createdAt: '2026-10-02T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      }),
    );
    await render(<NoteFormScreen />);

    expect(screen.getByTestId('note-title-input').props.value).toBe('Rent receipts');
    expect(screen.getByTestId('note-content-input').props.value).toBe('Keep every receipt');
    expect(screen.getByTestId('note-category-cat-1').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByTestId('note-tag-tag-1').props.accessibilityState?.selected).toBe(true);
    // A typed tag that is not stored yet renders as its own removable chip.
    expect(screen.getByTestId('note-tag-custom-receipt')).toBeTruthy();
    expect(screen.getByTestId('note-pin-toggle').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByText(/Created/)).toBeTruthy();
    expect(screen.getByText(/Updated/)).toBeTruthy();
    expect(screen.getByTestId('note-delete-button')).toBeTruthy();
  });

  it('routes category, tag and pin interactions to the hook', async () => {
    const setCategoryId = jest.fn();
    const setNewCategoryName = jest.fn();
    const addCategory = jest.fn().mockResolvedValue(undefined);
    const toggleTagName = jest.fn();
    const setNewTagName = jest.fn();
    const addNewTag = jest.fn();
    const setPinned = jest.fn();
    mockUseNoteForm.mockReturnValue(
      baseHookState({
        categories: [CATEGORY],
        existingTags: [TAG],
        selectedTagNames: ['tax'],
        setCategoryId,
        setNewCategoryName,
        addCategory,
        toggleTagName,
        setNewTagName,
        addNewTag,
        setPinned,
      }),
    );
    await render(<NoteFormScreen />);

    await fireEvent.press(screen.getByTestId('note-category-cat-1'));
    expect(setCategoryId).toHaveBeenCalledWith('cat-1');

    await fireEvent.press(screen.getByTestId('note-category-none'));
    expect(setCategoryId).toHaveBeenCalledWith(null);

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('note-new-category-input'), 'Work');
    });
    expect(setNewCategoryName).toHaveBeenCalledWith('Work');
    await act(async () => {
      await fireEvent.press(screen.getByTestId('note-add-category-button'));
    });
    await waitFor(() => expect(addCategory).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByTestId('note-tag-tag-1'));
    expect(toggleTagName).toHaveBeenCalledWith('tax');

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('note-tag-input'), 'receipt');
    });
    expect(setNewTagName).toHaveBeenCalledWith('receipt');
    await act(async () => {
      fireEvent(screen.getByTestId('note-tag-input'), 'submitEditing');
    });
    expect(addNewTag).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('note-pin-toggle'));
    expect(setPinned).toHaveBeenCalledWith(true);
  });

  it('deletes only after confirmation and then goes back', async () => {
    mockParams.mockReturnValue({ id: 'note-1' });
    const remove = jest.fn().mockResolvedValue(true);
    mockConfirmDestructive.mockResolvedValue(true);
    mockUseNoteForm.mockReturnValue(baseHookState({ mode: 'edit', title: 'Rent receipts', remove }));
    await render(<NoteFormScreen />);

    await fireEvent.press(screen.getByTestId('note-delete-button'));

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(mockConfirmDestructive).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete this note?',
        message: 'The note will be removed from this device. This cannot be undone.',
      }),
    );
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('keeps the note when the delete confirmation is declined', async () => {
    mockParams.mockReturnValue({ id: 'note-1' });
    const remove = jest.fn();
    mockConfirmDestructive.mockResolvedValue(false);
    mockUseNoteForm.mockReturnValue(baseHookState({ mode: 'edit', remove }));
    await render(<NoteFormScreen />);

    await fireEvent.press(screen.getByTestId('note-delete-button'));

    await waitFor(() => expect(mockConfirmDestructive).toHaveBeenCalled());
    expect(remove).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
