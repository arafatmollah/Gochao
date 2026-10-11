import { fireEvent, render, screen } from '@testing-library/react-native';

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

jest.mock('@/features/finance/hooks/use-transactions');

import { router } from 'expo-router';
import FinanceTransactionsScreen from '@/app/finance-transactions';
import { useTransactions } from '@/features/finance/hooks/use-transactions';

import { makeActivityRow } from '../helpers/factories';

const mockPush = router.push as jest.Mock;
const mockUseTransactions = useTransactions as jest.Mock;

function baseState(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'all',
    setKind: jest.fn(),
    search: '',
    setSearch: jest.fn(),
    filtersActive: false,
    clearFilters: jest.fn(),
    sections: [],
    loadedCount: 0,
    today: '2026-10-11',
    loading: false,
    refreshing: false,
    error: null,
    refresh: jest.fn(),
    ...overrides,
  };
}

describe('FinanceTransactionsScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders month sections with subtotals and opens rows by kind', async () => {
    const expense = makeActivityRow({ id: 'tx-1', kind: 'expense', amountMinor: 50_000 });
    const income = makeActivityRow({
      id: 'tx-2',
      kind: 'income',
      amountMinor: 500_000,
      description: 'Salary',
      categoryName: 'Salary',
    });
    const transfer = makeActivityRow({ id: 'tr-1', kind: 'transfer', amountMinor: 100_000 });
    mockUseTransactions.mockReturnValue(
      baseState({
        sections: [
          {
            key: '2026-10',
            data: [expense, transfer, income],
            incomeMinor: 500_000,
            expenseMinor: 50_000,
          },
        ],
        loadedCount: 3,
      }),
    );
    await render(<FinanceTransactionsScreen />);

    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getByText('৳5,000 in')).toBeTruthy();
    expect(screen.getByText('৳500 out')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('activity-row-tx-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/transaction-form', params: { id: 'tx-1' } });
    await fireEvent.press(screen.getByTestId('activity-row-tr-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/finance-transfer', params: { id: 'tr-1' } });
  });

  it('wires the filter chips, search and add buttons', async () => {
    const setKind = jest.fn();
    mockUseTransactions.mockReturnValue(baseState({ setKind }));
    await render(<FinanceTransactionsScreen />);

    await fireEvent.press(screen.getByTestId('transactions-filter-transfer'));
    expect(setKind).toHaveBeenCalledWith('transfer');

    await fireEvent.press(screen.getByTestId('transactions-add-income'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction-form',
      params: { kind: 'income' },
    });
    await fireEvent.press(screen.getByTestId('transactions-add-expense'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction-form',
      params: { kind: 'expense' },
    });

    expect(screen.getByText('No transactions yet')).toBeTruthy();
  });

  it('offers a clear-filters action when nothing matches', async () => {
    const clearFilters = jest.fn();
    mockUseTransactions.mockReturnValue(
      baseState({ filtersActive: true, loadedCount: 5, clearFilters }),
    );
    await render(<FinanceTransactionsScreen />);

    expect(screen.getByText('No matching transactions')).toBeTruthy();
    await fireEvent.press(screen.getByText('Clear filters'));
    expect(clearFilters).toHaveBeenCalled();
  });
});
