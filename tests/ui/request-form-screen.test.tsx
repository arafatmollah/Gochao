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

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/confirm', () => ({
  confirmDestructive: jest.fn(),
}));

jest.mock('@/features/family/hooks/use-request-form');

import { router, useLocalSearchParams } from 'expo-router';
import RequestFormScreen from '@/app/request-form';
import { confirmDestructive } from '@/components/confirm';
import { useRequestForm } from '@/features/family/hooks/use-request-form';
import { addDaysIsoDate, todayIsoDate } from '@/utils/dates';

const mockBack = router.back as jest.Mock;
const mockUseRequestForm = useRequestForm as jest.Mock;
const mockConfirmDestructive = confirmDestructive as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;

const MEMBER = {
  id: 'member-1',
  name: 'Karim',
  relationship: 'father',
  contact: null,
  notes: null,
  isArchived: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};
const ARCHIVED_MEMBER = { ...MEMBER, id: 'member-2', name: 'Rahima', isArchived: true };

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'new',
    loading: false,
    loadError: null,
    title: '',
    setTitle: jest.fn(),
    details: '',
    setDetails: jest.fn(),
    memberId: null,
    setMemberId: jest.fn(),
    category: 'other',
    setCategory: jest.fn(),
    priority: 'medium',
    setPriority: jest.fn(),
    deadline: null,
    setDeadline: jest.fn(),
    costText: '',
    setCostText: jest.fn(),
    members: [] as unknown[],
    taskId: null,
    status: 'open',
    changeStatus: jest.fn().mockResolvedValue(undefined),
    saving: false,
    notice: null,
    clearNotice: jest.fn(),
    createdAt: null,
    updatedAt: null,
    save: jest.fn().mockResolvedValue(true),
    remove: jest.fn().mockResolvedValue(true),
    generateTask: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('RequestFormScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockConfirmDestructive.mockReset();
    mockParams.mockReturnValue({});
  });

  it('offers title, member, category, priority, deadline and cost controls for a new request', async () => {
    mockUseRequestForm.mockReturnValue(baseHookState({ members: [MEMBER, ARCHIVED_MEMBER] }));
    await render(<RequestFormScreen />);

    expect(screen.getByTestId('request-title-input')).toBeTruthy();
    expect(screen.getByTestId('request-details-input')).toBeTruthy();
    expect(screen.getByTestId('request-member-none')).toBeTruthy();
    expect(screen.getByTestId('request-member-member-1')).toBeTruthy();
    expect(screen.getByTestId('request-category-medicine')).toBeTruthy();
    expect(screen.getByTestId('request-priority-high')).toBeTruthy();
    expect(screen.getByTestId('request-quick-deadline-today')).toBeTruthy();
    expect(screen.getByTestId('request-quick-deadline-tomorrow')).toBeTruthy();
    expect(screen.getByTestId('request-quick-deadline-week')).toBeTruthy();
    expect(screen.getByTestId('request-quick-deadline-none')).toBeTruthy();
    expect(screen.getByText('No deadline set')).toBeTruthy();
    expect(screen.getByTestId('request-cost-input')).toBeTruthy();
    expect(screen.getByTestId('request-save-button')).toBeTruthy();

    // A new request has no status control, no task action and nothing to delete.
    expect(screen.queryByTestId('request-status-open')).toBeNull();
    expect(screen.queryByTestId('request-create-task-button')).toBeNull();
    expect(screen.queryByTestId('request-delete-button')).toBeNull();
    expect(screen.queryByText(/Created/)).toBeNull();
    // Archived members stay selectable but are clearly marked.
    expect(screen.getByText('Rahima (Archived)')).toBeTruthy();
  });

  it('saves and goes back when the request is stored', async () => {
    const save = jest.fn().mockResolvedValue(true);
    mockUseRequestForm.mockReturnValue(baseHookState({ save }));
    await render(<RequestFormScreen />);

    await fireEvent.press(screen.getByTestId('request-save-button'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(mockBack).toHaveBeenCalled();
  });

  it('keeps the draft on screen and surfaces the reason when saving fails', async () => {
    const save = jest.fn().mockResolvedValue(false);
    mockUseRequestForm.mockReturnValue(
      baseHookState({ save, notice: 'Add a title first.' }),
    );
    await render(<RequestFormScreen />);

    await fireEvent.press(screen.getByTestId('request-save-button'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByTestId('request-form-notice')).toBeTruthy();
    expect(screen.getByText('Add a title first.')).toBeTruthy();
  });

  it('routes text input to the hook and normalizes Bangla digits in the cost', async () => {
    const setTitle = jest.fn();
    const setDetails = jest.fn();
    const setCostText = jest.fn();
    mockUseRequestForm.mockReturnValue(baseHookState({ setTitle, setDetails, setCostText }));
    await render(<RequestFormScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('request-title-input'), 'Buy medicine');
    });
    expect(setTitle).toHaveBeenCalledWith('Buy medicine');

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('request-details-input'), 'Amlodipine 5mg');
    });
    expect(setDetails).toHaveBeenCalledWith('Amlodipine 5mg');

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('request-cost-input'), '৪৫০');
    });
    expect(setCostText).toHaveBeenCalledWith('450');
  });

  it('shows a loading state instead of an empty form while an existing request loads', async () => {
    mockParams.mockReturnValue({ id: 'req-1' });
    mockUseRequestForm.mockReturnValue(baseHookState({ mode: 'edit', loading: true }));
    await render(<RequestFormScreen />);

    expect(screen.queryByTestId('request-title-input')).toBeNull();
    expect(screen.queryByTestId('request-save-button')).toBeNull();
  });

  it('shows a dismissible error and no form when the request could not be loaded', async () => {
    mockParams.mockReturnValue({ id: 'req-missing' });
    mockUseRequestForm.mockReturnValue(
      baseHookState({ mode: 'edit', loadError: 'That request no longer exists.' }),
    );
    await render(<RequestFormScreen />);

    expect(screen.getByText('That request no longer exists.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('loads the stored request with its member, category, priority, deadline and dates', async () => {
    mockParams.mockReturnValue({ id: 'req-1' });
    mockUseRequestForm.mockReturnValue(
      baseHookState({
        mode: 'edit',
        title: 'Buy medicine for father',
        details: 'Amlodipine 5mg',
        memberId: 'member-1',
        members: [MEMBER],
        category: 'medicine',
        priority: 'high',
        deadline: '2026-10-20',
        costText: '450',
        status: 'in_progress',
        createdAt: '2026-10-02T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      }),
    );
    await render(<RequestFormScreen />);

    expect(screen.getByTestId('request-title-input').props.value).toBe('Buy medicine for father');
    expect(screen.getByTestId('request-details-input').props.value).toBe('Amlodipine 5mg');
    expect(screen.getByTestId('request-cost-input').props.value).toBe('450');
    expect(screen.getByTestId('request-member-member-1').props.accessibilityState?.selected).toBe(
      true,
    );
    expect(screen.getByTestId('request-category-medicine').props.accessibilityState?.selected).toBe(
      true,
    );
    expect(screen.getByTestId('request-priority-high').props.accessibilityState?.selected).toBe(
      true,
    );
    expect(screen.getByTestId('request-status-in_progress').props.accessibilityState?.selected).toBe(
      true,
    );
    // Deadline caption shows the parsed date plus a relative hint.
    expect(screen.getByText(/October 20, 2026 \(/)).toBeTruthy();
    expect(screen.getByText(/Created/)).toBeTruthy();
    expect(screen.getByText(/Updated/)).toBeTruthy();
    expect(screen.getByTestId('request-delete-button')).toBeTruthy();
  });

  it('routes member, category and priority chips to the hook', async () => {
    const setMemberId = jest.fn();
    const setCategory = jest.fn();
    const setPriority = jest.fn();
    mockUseRequestForm.mockReturnValue(
      baseHookState({ members: [MEMBER], setMemberId, setCategory, setPriority }),
    );
    await render(<RequestFormScreen />);

    await fireEvent.press(screen.getByTestId('request-member-member-1'));
    expect(setMemberId).toHaveBeenCalledWith('member-1');

    await fireEvent.press(screen.getByTestId('request-member-none'));
    expect(setMemberId).toHaveBeenCalledWith(null);

    await fireEvent.press(screen.getByTestId('request-category-grocery'));
    expect(setCategory).toHaveBeenCalledWith('grocery');

    await fireEvent.press(screen.getByTestId('request-priority-high'));
    expect(setPriority).toHaveBeenCalledWith('high');
  });

  it('clears the deadline via the no-date quick chip', async () => {
    const setDeadline = jest.fn();
    mockUseRequestForm.mockReturnValue(baseHookState({ mode: 'edit', deadline: '2026-10-20', setDeadline }));
    await render(<RequestFormScreen />);

    await fireEvent.press(screen.getByTestId('request-quick-deadline-none'));
    expect(setDeadline).toHaveBeenCalledWith(null);
  });

  it('picks a quick deadline through the chips', async () => {
    const setDeadline = jest.fn();
    mockUseRequestForm.mockReturnValue(baseHookState({ setDeadline }));
    await render(<RequestFormScreen />);

    await fireEvent.press(screen.getByTestId('request-quick-deadline-tomorrow'));
    expect(setDeadline).toHaveBeenCalledWith(addDaysIsoDate(todayIsoDate(), 1));
  });

  it('changes status immediately and generates a task in edit mode', async () => {
    const changeStatus = jest.fn().mockResolvedValue(undefined);
    const generateTask = jest.fn().mockResolvedValue(true);
    mockParams.mockReturnValue({ id: 'req-1' });
    mockUseRequestForm.mockReturnValue(
      baseHookState({ mode: 'edit', changeStatus, generateTask }),
    );
    await render(<RequestFormScreen />);

    await fireEvent.press(screen.getByTestId('request-status-done'));
    await waitFor(() => expect(changeStatus).toHaveBeenCalledWith('done'));

    await fireEvent.press(screen.getByTestId('request-create-task-button'));
    await waitFor(() => expect(generateTask).toHaveBeenCalledTimes(1));
  });

  it('shows the linked-task caption instead of the create-task button once a task exists', async () => {
    mockParams.mockReturnValue({ id: 'req-1' });
    mockUseRequestForm.mockReturnValue(baseHookState({ mode: 'edit', taskId: 'task-9' }));
    await render(<RequestFormScreen />);

    expect(screen.getByText('A task has been created from this request.')).toBeTruthy();
    expect(screen.queryByTestId('request-create-task-button')).toBeNull();
  });

  it('deletes only after confirmation and then goes back', async () => {
    mockParams.mockReturnValue({ id: 'req-1' });
    const remove = jest.fn().mockResolvedValue(true);
    mockConfirmDestructive.mockResolvedValue(true);
    mockUseRequestForm.mockReturnValue(
      baseHookState({ mode: 'edit', title: 'Buy medicine for father', remove }),
    );
    await render(<RequestFormScreen />);

    await fireEvent.press(screen.getByTestId('request-delete-button'));

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(mockConfirmDestructive).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete this request?',
        message:
          '"Buy medicine for father" will be removed. A task already created from it will stay on the Tasks tab.',
      }),
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it('keeps the request when the delete confirmation is declined', async () => {
    mockParams.mockReturnValue({ id: 'req-1' });
    const remove = jest.fn();
    mockConfirmDestructive.mockResolvedValue(false);
    mockUseRequestForm.mockReturnValue(baseHookState({ mode: 'edit', remove }));
    await render(<RequestFormScreen />);

    await fireEvent.press(screen.getByTestId('request-delete-button'));

    await waitFor(() => expect(mockConfirmDestructive).toHaveBeenCalled());
    expect(remove).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
