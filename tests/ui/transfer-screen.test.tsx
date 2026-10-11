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

jest.mock('@/features/finance/hooks/use-transfer-form');

import { router } from 'expo-router';
import TransferScreen from '@/app/finance-transfer';
import { confirmDestructive } from '@/components/confirm';
import { useTransferForm } from '@/features/finance/hooks/use-transfer-form';
import { todayIsoDate } from '@/utils/dates';

import { makeAccount } from '../helpers/factories';

const mockBack = router.back as jest.Mock;
const mockUseForm = useTransferForm as jest.Mock;
const mockConfirmDestructive = confirmDestructive as jest.Mock;

function baseState(overrides: Record<string, unknown> = {}) {
  return {
    isEdit: false,
    loadState: 'ready',
    loadError: null,
    retryLoad: jest.fn(),
    accounts: [
      makeAccount({ id: 'acc-1', name: 'Cash' }),
      makeAccount({ id: 'acc-2', name: 'Bank' }),
    ],
    fromAccountId: 'acc-1',
    setFromAccountId: jest.fn(),
    toAccountId: 'acc-2',
    setToAccountId: jest.fn(),
    accountsError: null,
    amountText: '500',
    setAmountText: jest.fn(),
    amountError: null,
    occurredOn: todayIsoDate(),
    setOccurredOn: jest.fn(),
    occurredOnError: null,
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

describe('TransferScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockConfirmDestructive.mockReset();
  });

  it('submits a transfer between two accounts and returns', async () => {
    const submit = jest.fn(async () => true);
    mockUseForm.mockReturnValue(baseState({ submit }));
    await render(<TransferScreen />);

    expect(screen.getByTestId('transfer-from-acc-1')).toBeTruthy();
    expect(screen.getByTestId('transfer-to-acc-2')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('save-transfer-button'));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('surfaces the same-account guard from the form state', async () => {
    mockUseForm.mockReturnValue(
      baseState({ accountsError: 'transfer_same_account', submit: jest.fn(async () => false) }),
    );
    await render(<TransferScreen />);

    expect(screen.getByText('Choose two different accounts for a transfer.')).toBeTruthy();
  });

  it('deletes an existing transfer after confirmation', async () => {
    const remove = jest.fn(async () => true);
    mockUseForm.mockReturnValue(baseState({ isEdit: true, remove }));
    await render(<TransferScreen />);

    mockConfirmDestructive.mockResolvedValue(true);
    await fireEvent.press(screen.getByTestId('delete-transfer-button'));
    await waitFor(() => expect(remove).toHaveBeenCalled());
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('offers account creation when none exist', async () => {
    mockUseForm.mockReturnValue(baseState({ accounts: [], fromAccountId: null, toAccountId: null }));
    await render(<TransferScreen />);

    expect(screen.getByTestId('transfer-no-accounts')).toBeTruthy();
  });
});
