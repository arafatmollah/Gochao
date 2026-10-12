import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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

jest.mock('@/features/family/hooks/use-member-form');

import { router, useLocalSearchParams } from 'expo-router';
import MemberFormScreen from '@/app/member-form';
import { confirmDestructive } from '@/components/confirm';
import { useMemberForm } from '@/features/family/hooks/use-member-form';

const mockBack = router.back as jest.Mock;
const mockUseMemberForm = useMemberForm as jest.Mock;
const mockConfirmDestructive = confirmDestructive as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'new',
    loading: false,
    loadError: null,
    name: '',
    setName: jest.fn(),
    relationship: 'other',
    setRelationship: jest.fn(),
    contact: '',
    setContact: jest.fn(),
    notes: '',
    setNotes: jest.fn(),
    isArchived: false,
    toggleArchived: jest.fn(),
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

describe('MemberFormScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockConfirmDestructive.mockReset();
    mockParams.mockReturnValue({});
  });

  it('offers name, relationship, contact and notes controls for a new member', async () => {
    mockUseMemberForm.mockReturnValue(baseHookState());
    await render(<MemberFormScreen />);

    expect(screen.getByTestId('member-name-input')).toBeTruthy();
    expect(screen.getByTestId('member-relationship-self')).toBeTruthy();
    expect(screen.getByTestId('member-relationship-spouse')).toBeTruthy();
    expect(screen.getByTestId('member-relationship-father')).toBeTruthy();
    expect(screen.getByTestId('member-relationship-mother')).toBeTruthy();
    expect(screen.getByTestId('member-relationship-son')).toBeTruthy();
    expect(screen.getByTestId('member-relationship-daughter')).toBeTruthy();
    expect(screen.getByTestId('member-relationship-sibling')).toBeTruthy();
    expect(screen.getByTestId('member-relationship-other')).toBeTruthy();
    expect(screen.getByTestId('member-contact-input')).toBeTruthy();
    expect(screen.getByTestId('member-notes-input')).toBeTruthy();
    expect(screen.getByTestId('member-save-button')).toBeTruthy();

    // A new member has no archive control, no delete and no stored timestamps.
    expect(screen.queryByTestId('member-archive-toggle')).toBeNull();
    expect(screen.queryByTestId('member-delete-button')).toBeNull();
    expect(screen.queryByText(/Added/)).toBeNull();
  });

  it('saves and goes back when the member is stored', async () => {
    const save = jest.fn().mockResolvedValue(true);
    mockUseMemberForm.mockReturnValue(baseHookState({ save }));
    await render(<MemberFormScreen />);

    await fireEvent.press(screen.getByTestId('member-save-button'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(mockBack).toHaveBeenCalled();
  });

  it('keeps the draft on screen and surfaces the reason when saving fails', async () => {
    const save = jest.fn().mockResolvedValue(false);
    mockUseMemberForm.mockReturnValue(
      baseHookState({ save, notice: "Enter the member's name." }),
    );
    await render(<MemberFormScreen />);

    await fireEvent.press(screen.getByTestId('member-save-button'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByTestId('member-form-notice')).toBeTruthy();
    expect(screen.getByText("Enter the member's name.")).toBeTruthy();
  });

  it('shows a loading state instead of an empty form while an existing member loads', async () => {
    mockParams.mockReturnValue({ id: 'member-1' });
    mockUseMemberForm.mockReturnValue(baseHookState({ mode: 'edit', loading: true }));
    await render(<MemberFormScreen />);

    expect(screen.queryByTestId('member-name-input')).toBeNull();
    expect(screen.queryByTestId('member-save-button')).toBeNull();
  });

  it('shows a dismissible error and no form when the member could not be loaded', async () => {
    mockParams.mockReturnValue({ id: 'member-missing' });
    mockUseMemberForm.mockReturnValue(
      baseHookState({ mode: 'edit', loadError: 'That member no longer exists.' }),
    );
    await render(<MemberFormScreen />);

    expect(screen.getByText('That member no longer exists.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('loads the stored member with relationship, details and dates', async () => {
    mockParams.mockReturnValue({ id: 'member-1' });
    mockUseMemberForm.mockReturnValue(
      baseHookState({
        mode: 'edit',
        name: 'Karim',
        relationship: 'father',
        contact: '01711-000000',
        notes: 'Prefers evening calls',
        isArchived: false,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-05T00:00:00.000Z',
      }),
    );
    await render(<MemberFormScreen />);

    expect(screen.getByTestId('member-name-input').props.value).toBe('Karim');
    expect(screen.getByTestId('member-contact-input').props.value).toBe('01711-000000');
    expect(screen.getByTestId('member-notes-input').props.value).toBe('Prefers evening calls');
    expect(screen.getByTestId('member-relationship-father').props.accessibilityState?.selected).toBe(
      true,
    );
    expect(screen.getByTestId('member-archive-toggle')).toBeTruthy();
    expect(screen.getByText('Archive member')).toBeTruthy();
    expect(screen.getByText(/Added/)).toBeTruthy();
    expect(screen.getByText(/Updated/)).toBeTruthy();
    expect(screen.getByTestId('member-delete-button')).toBeTruthy();
  });

  it('routes relationship chips and the archive toggle to the hook', async () => {
    const setRelationship = jest.fn();
    const toggleArchived = jest.fn();
    mockUseMemberForm.mockReturnValue(
      baseHookState({ mode: 'edit', setRelationship, toggleArchived }),
    );
    await render(<MemberFormScreen />);

    await fireEvent.press(screen.getByTestId('member-relationship-mother'));
    expect(setRelationship).toHaveBeenCalledWith('mother');

    await fireEvent.press(screen.getByTestId('member-archive-toggle'));
    expect(toggleArchived).toHaveBeenCalledTimes(1);
  });

  it('offers the restore action while the member is archived', async () => {
    mockUseMemberForm.mockReturnValue(baseHookState({ mode: 'edit', isArchived: true }));
    await render(<MemberFormScreen />);

    expect(screen.getByText('Restore member')).toBeTruthy();
    expect(screen.getByTestId('member-archive-toggle').props.accessibilityState?.selected).toBe(
      true,
    );
    expect(
      screen.getByText(
        'This member is archived. Save to keep, or restore to bring them back.',
      ),
    ).toBeTruthy();
  });

  it('deletes only after confirmation and then goes back', async () => {
    mockParams.mockReturnValue({ id: 'member-1' });
    const remove = jest.fn().mockResolvedValue(true);
    mockConfirmDestructive.mockResolvedValue(true);
    mockUseMemberForm.mockReturnValue(baseHookState({ mode: 'edit', name: 'Karim', remove }));
    await render(<MemberFormScreen />);

    await fireEvent.press(screen.getByTestId('member-delete-button'));

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(mockConfirmDestructive).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete this member?',
        message:
          '"Karim" will be removed. Members with requests must be archived instead.',
      }),
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it('keeps the member when the delete confirmation is declined', async () => {
    mockParams.mockReturnValue({ id: 'member-1' });
    const remove = jest.fn();
    mockConfirmDestructive.mockResolvedValue(false);
    mockUseMemberForm.mockReturnValue(baseHookState({ mode: 'edit', remove }));
    await render(<MemberFormScreen />);

    await fireEvent.press(screen.getByTestId('member-delete-button'));

    await waitFor(() => expect(mockConfirmDestructive).toHaveBeenCalled());
    expect(remove).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('stays on screen with the conflict reason when deleting a member with requests', async () => {
    mockParams.mockReturnValue({ id: 'member-1' });
    const remove = jest.fn().mockResolvedValue(false);
    mockConfirmDestructive.mockResolvedValue(true);
    mockUseMemberForm.mockReturnValue(
      baseHookState({
        mode: 'edit',
        remove,
        notice: 'Karim still has requests. Archive the member instead.',
      }),
    );
    await render(<MemberFormScreen />);

    await fireEvent.press(screen.getByTestId('member-delete-button'));

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByTestId('member-form-notice')).toBeTruthy();
    expect(screen.getByText('Karim still has requests. Archive the member instead.')).toBeTruthy();
  });
});
