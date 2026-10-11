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
  useFocusEffect: jest.fn(),
}));

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/confirm', () => ({
  confirmDestructive: jest.fn(),
}));

jest.mock('@/features/finance/hooks/use-transaction-form');

import { router } from 'expo-router';
import TransactionFormScreen from '@/app/transaction-form';
import { confirmDestructive } from '@/components/confirm';
import { useTransactionForm } from '@/features/finance/hooks/use-transaction-form';
import { todayIsoDate } from '@/utils/dates';

import { makeAccount, makeCategory } from '../helpers/factories';

const mockPush = router.push as jest.Mock;
const mockBack = router.back as jest.Mock;
const mockUseForm = useTransactionForm as jest.Mock;
const mockConfirmDestructive = confirmDestructive as jest.Mock;

function baseState(overrides: Record<string, unknown> = {}) {
  return {
    isEdit: false,
    kind: 'expense',
    lockedByBill: false,
    loadState: 'ready',
    loadError: null,
    retryLoad: jest.fn(),
    accounts: [makeAccount({ id: 'acc-1', name: 'Cash' })],
    categories: [makeCategory({ id: 'cat_expense_food', name: 'Food' })],
    amountText: '1250',
    setAmountText: jest.fn(),
    amountError: null,
    accountId: 'acc-1',
    setAccountId: jest.fn(),
    accountError: null,
    categoryId: 'cat_expense_food',
    setCategoryId: jest.fn(),
    categoryError: null,
    occurredOn: todayIsoDate(),
    setOccurredOn: jest.fn(),
    occurredOnError: null,
    description: 'Groceries',
    setDescription: jest.fn(),
    descriptionError: null,
    recipient: '',
    setRecipient: jest.fn(),
    recipientError: null,
    notes: '',
    setNotes: jest.fn(),
    notesError: null,
    formError: null,
    saving: false,
    deleting: false,
    submit: jest.fn(async () => true),
    remove: jest.fn(async () => true),
    ...overrides,
  };
}

describe('TransactionFormScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockConfirmDestructive.mockReset();
  });

  it('adds an expense and returns after saving', async () => {
    const submit = jest.fn(async () => true);
    mockUseForm.mockReturnValue(baseState({ submit }));
    await render(<TransactionFormScreen />);

    expect(screen.getByText('Add expense')).toBeTruthy();
    expect(screen.getByText('Paid to (optional)')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('save-transaction-button'));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('hides the recipient field for income and shows the income CTA', async () => {
    mockUseForm.mockReturnValue(baseState({ kind: 'income' }));
    await render(<TransactionFormScreen />);

    expect(screen.getByText('Add income')).toBeTruthy();
    expect(screen.queryByText('Paid to (optional)')).toBeNull();
  });

  it('locks bill-linked expenses: notes banner, disabled save, no delete', async () => {
    mockUseForm.mockReturnValue(
      baseState({ isEdit: true, lockedByBill: true, kind: 'expense' }),
    );
    await render(<TransactionFormScreen />);

    expect(
      screen.getByText(
        'This expense was created by recording a bill payment. To change it, undo the payment on the bill.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('save-transaction-button').props.accessibilityState?.disabled).toBe(
      true,
    );
    expect(screen.queryByTestId('delete-transaction-button')).toBeNull();
  });

  it('edits a transaction and deletes it after confirmation', async () => {
    const remove = jest.fn(async () => true);
    mockUseForm.mockReturnValue(baseState({ isEdit: true, kind: 'expense', remove }));
    await render(<TransactionFormScreen />);

    expect(screen.getByText('Save changes')).toBeTruthy();

    mockConfirmDestructive.mockResolvedValue(false);
    await fireEvent.press(screen.getByTestId('delete-transaction-button'));
    await waitFor(() => expect(mockConfirmDestructive).toHaveBeenCalled());
    expect(remove).not.toHaveBeenCalled();

    mockConfirmDestructive.mockResolvedValue(true);
    await fireEvent.press(screen.getByTestId('delete-transaction-button'));
    await waitFor(() => expect(remove).toHaveBeenCalled());
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('offers to add an account when none exist', async () => {
    mockUseForm.mockReturnValue(baseState({ accounts: [], accountId: null }));
    await render(<TransactionFormScreen />);

    expect(screen.getByTestId('transaction-form-no-accounts')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add an account'));
    expect(mockPush).toHaveBeenCalledWith('/account-form');
  });
});
