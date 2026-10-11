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

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/confirm', () => ({
  confirmDestructive: jest.fn(),
}));

jest.mock('@/features/bills/hooks/use-bill-form');

import { router, useLocalSearchParams } from 'expo-router';
import BillFormScreen from '@/app/bill-form';
import { confirmDestructive } from '@/components/confirm';
import { useBillForm } from '@/features/bills/hooks/use-bill-form';
import { todayIsoDate } from '@/utils/dates';

const mockRouter = router as unknown as {
  push: jest.Mock;
  back: jest.Mock;
  replace: jest.Mock;
  canGoBack: jest.Mock;
};
const mockUseBillForm = useBillForm as jest.Mock;
const mockConfirmDestructive = confirmDestructive as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    isEdit: false,
    loadState: 'ready',
    loadError: null,
    retryLoad: jest.fn(),
    name: '',
    setName: jest.fn(),
    nameError: null,
    amountText: '',
    setAmountText: jest.fn(),
    amountError: null,
    category: 'other',
    setCategory: jest.fn(),
    recurrence: 'monthly',
    setRecurrence: jest.fn(),
    firstDueOn: todayIsoDate(),
    setFirstDueOn: jest.fn(),
    firstDueError: null,
    installmentText: '',
    setInstallmentText: jest.fn(),
    installmentError: null,
    reminderText: '',
    setReminderText: jest.fn(),
    reminderError: null,
    notes: '',
    setNotes: jest.fn(),
    notesError: null,
    formError: null,
    saving: false,
    deleting: false,
    submit: jest.fn(),
    remove: jest.fn(),
    ...overrides,
  };
}

describe('BillFormScreen', () => {
  beforeEach(() => {
    mockRouter.back.mockClear();
    mockRouter.replace.mockClear();
    mockRouter.canGoBack.mockReturnValue(true);
    mockConfirmDestructive.mockReset();
    mockParams.mockReturnValue({});
  });

  it('creates a bill: core fields, repeat chips and the due-date entry are shown', async () => {
    mockUseBillForm.mockReturnValue(baseHookState());
    await render(<BillFormScreen />);

    expect(screen.getByTestId('bill-name-input')).toBeTruthy();
    expect(screen.getByTestId('bill-amount-input')).toBeTruthy();
    expect(screen.getByTestId('bill-due-input')).toBeTruthy();
    expect(screen.getByTestId('bill-recurrence-monthly')).toBeTruthy();
    expect(screen.getByTestId('bill-category-rent')).toBeTruthy();

    // Installments apply only to repeating schedules; monthly shows the field.
    expect(screen.getByTestId('bill-installments-input')).toBeTruthy();
  });

  it('hides the installments field for a one-time bill', async () => {
    mockUseBillForm.mockReturnValue(baseHookState({ recurrence: 'none' }));
    await render(<BillFormScreen />);

    expect(screen.queryByTestId('bill-installments-input')).toBeNull();
  });

  it('submits and returns when the bill is saved', async () => {
    const submit = jest.fn().mockResolvedValue(true);
    mockUseBillForm.mockReturnValue(baseHookState({ submit }));
    await render(<BillFormScreen />);

    await fireEvent.press(screen.getByTestId('save-bill-button'));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('renders translated field errors reported by the hook', async () => {
    mockUseBillForm.mockReturnValue(
      baseHookState({ nameError: 'bill_name_required', formError: 'Could not save the bill.' }),
    );
    await render(<BillFormScreen />);

    expect(screen.getByText('Please enter a bill name.')).toBeTruthy();
    expect(screen.getByText('Could not save the bill.')).toBeTruthy();
  });

  it('edits a bill: schedule is read-only with an explanation and delete is offered', async () => {
    mockParams.mockReturnValue({ id: 'bill-1' });
    mockUseBillForm.mockReturnValue(
      baseHookState({
        isEdit: true,
        name: 'House rent',
        amountText: '15000',
        recurrence: 'monthly',
        firstDueOn: '2026-10-05',
      }),
    );
    await render(<BillFormScreen />);

    expect(screen.getByTestId('bill-name-input').props.value).toBe('House rent');
    // Repeat chips are create-only; edit shows the immutable schedule line.
    expect(screen.queryByTestId('bill-recurrence-weekly')).toBeNull();
    expect(screen.getByText('The repeat schedule can\'t be changed after creation.')).toBeTruthy();
    expect(screen.getByTestId('delete-bill-button')).toBeTruthy();
  });

  it('deletes only after confirmation and then goes back', async () => {
    mockParams.mockReturnValue({ id: 'bill-1' });
    const remove = jest.fn().mockResolvedValue(true);
    mockConfirmDestructive.mockResolvedValue(true);
    mockUseBillForm.mockReturnValue(
      baseHookState({ isEdit: true, name: 'House rent', remove }),
    );
    await render(<BillFormScreen />);

    await fireEvent.press(screen.getByTestId('delete-bill-button'));

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(mockConfirmDestructive).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          '"House rent" and its unpaid schedule will be permanently deleted. This cannot be undone.',
      }),
    );
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('keeps the bill when the delete confirmation is declined', async () => {
    mockParams.mockReturnValue({ id: 'bill-1' });
    const remove = jest.fn();
    mockConfirmDestructive.mockResolvedValue(false);
    mockUseBillForm.mockReturnValue(
      baseHookState({ isEdit: true, name: 'House rent', remove }),
    );
    await render(<BillFormScreen />);

    await fireEvent.press(screen.getByTestId('delete-bill-button'));

    await waitFor(() => expect(mockConfirmDestructive).toHaveBeenCalled());
    expect(remove).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
