import { fireEvent, render, screen, within } from '@testing-library/react-native';

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

jest.mock('@/features/finance/hooks/use-finance-overview');
jest.mock('@/features/finance/hooks/use-accounts');

import { router } from 'expo-router';
import FinanceScreen from '@/app/(tabs)/finance';
import FinanceAccountsScreen from '@/app/finance-accounts';
import { useAccounts } from '@/features/finance/hooks/use-accounts';
import { useFinanceOverview } from '@/features/finance/hooks/use-finance-overview';

import { makeAccountWithBalance, makeActivityRow } from '../helpers/factories';

const mockPush = router.push as jest.Mock;
const mockUseFinanceOverview = useFinanceOverview as jest.Mock;
const mockUseAccounts = useAccounts as jest.Mock;

describe('FinanceScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  function baseOverview(overrides: Record<string, unknown> = {}) {
    return {
      accounts: [],
      totalBalanceMinor: 0,
      monthTotals: { incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
      recent: [],
      loading: false,
      refreshing: false,
      error: null,
      refresh: jest.fn(),
      ...overrides,
    };
  }

  it('renders the hero balance with derived figures and the quick actions', async () => {
    mockUseFinanceOverview.mockReturnValue(
      baseOverview({
        totalBalanceMinor: 145_500,
        monthTotals: { incomeMinor: 500_000, expenseMinor: 320_000, netMinor: 180_000 },
      }),
    );
    await render(<FinanceScreen />);

    const card = screen.getByTestId('finance-balance-card');
    expect(within(card).getByText('Total balance')).toBeTruthy();
    expect(within(card).getByText('৳1,455')).toBeTruthy();
    expect(within(card).getByText('৳5,000')).toBeTruthy();
    expect(within(card).getByText('৳3,200')).toBeTruthy();
    expect(within(card).getByText('৳1,800')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('finance-quick-add-income'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction-form',
      params: { kind: 'income' },
    });
    await fireEvent.press(screen.getByTestId('finance-quick-add-expense'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction-form',
      params: { kind: 'expense' },
    });
    await fireEvent.press(screen.getByTestId('finance-quick-transfer'));
    expect(mockPush).toHaveBeenCalledWith('/finance-transfer');
    await fireEvent.press(screen.getByTestId('finance-quick-reports'));
    expect(mockPush).toHaveBeenCalledWith('/finance-reports');
  });

  it('previews accounts, activity and links', async () => {
    const accounts = [
      makeAccountWithBalance({ id: 'acc-1', name: 'Cash', balanceMinor: 100_000 }),
      makeAccountWithBalance({ id: 'acc-2', name: 'Bank', type: 'bank', balanceMinor: 45_500 }),
      makeAccountWithBalance({ id: 'acc-3', name: 'bKash', type: 'mfs', balanceMinor: 0 }),
    ];
    const expense = makeActivityRow({ id: 'tx-1', kind: 'expense', amountMinor: 50_000 });
    const transfer = makeActivityRow({
      id: 'tr-1',
      kind: 'transfer',
      amountMinor: 100_000,
    });
    mockUseFinanceOverview.mockReturnValue(
      baseOverview({ accounts, totalBalanceMinor: 145_500, recent: [expense, transfer] }),
    );
    await render(<FinanceScreen />);

    expect(screen.getByText('Cash')).toBeTruthy();
    expect(screen.getByText('Bank')).toBeTruthy();
    expect(screen.getByText('bKash')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('finance-account-acc-2'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/account-form', params: { id: 'acc-2' } });

    await fireEvent.press(screen.getByTestId('finance-activity-tx-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/transaction-form', params: { id: 'tx-1' } });
    await fireEvent.press(screen.getByTestId('finance-activity-tr-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/finance-transfer', params: { id: 'tr-1' } });

    await fireEvent.press(screen.getByTestId('finance-all-transactions'));
    expect(mockPush).toHaveBeenCalledWith('/finance-transactions');

    await fireEvent.press(screen.getByTestId('finance-manage-accounts'));
    expect(mockPush).toHaveBeenCalledWith('/finance-accounts');
    await fireEvent.press(screen.getByTestId('finance-link-budgets'));
    expect(mockPush).toHaveBeenCalledWith('/finance-budgets');
    await fireEvent.press(screen.getByTestId('finance-link-categories'));
    expect(mockPush).toHaveBeenCalledWith('/finance-categories');
  });

  it('shows honest empty states with an add-account action', async () => {
    mockUseFinanceOverview.mockReturnValue(baseOverview());
    await render(<FinanceScreen />);

    expect(screen.getByText('No accounts yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add an account'));
    expect(mockPush).toHaveBeenCalledWith('/account-form');

    expect(screen.getByText('No activity yet')).toBeTruthy();
  });

  it('asks for more than three accounts only when they exist', async () => {
    const accounts = Array.from({ length: 4 }, (_, index) =>
      makeAccountWithBalance({ id: `acc-${index}`, name: `Account ${index}` }),
    );
    mockUseFinanceOverview.mockReturnValue(baseOverview({ accounts }));
    await render(<FinanceScreen />);

    expect(screen.queryByTestId('finance-account-acc-3')).toBeNull();
    await fireEvent.press(screen.getByTestId('finance-see-all-accounts'));
    expect(mockPush).toHaveBeenCalledWith('/finance-accounts');
  });
});

describe('FinanceAccountsScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  function baseAccounts(overrides: Record<string, unknown> = {}) {
    return {
      accounts: [],
      includeArchived: false,
      setIncludeArchived: jest.fn(),
      loading: false,
      refreshing: false,
      error: null,
      refresh: jest.fn(),
      ...overrides,
    };
  }

  it('lists accounts with derived balances and opens the form', async () => {
    mockUseAccounts.mockReturnValue(
      baseAccounts({
        accounts: [
          makeAccountWithBalance({
            id: 'acc-1',
            name: 'Cash',
            balanceMinor: 100_000,
            transactionCount: 3,
          }),
        ],
      }),
    );
    await render(<FinanceAccountsScreen />);

    expect(screen.getByText('Cash')).toBeTruthy();
    expect(screen.getByText('৳1,000')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('account-row-acc-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/account-form', params: { id: 'acc-1' } });

    await fireEvent.press(screen.getByTestId('add-account-fab'));
    expect(mockPush).toHaveBeenCalledWith('/account-form');
  });

  it('toggles archived accounts through the hook', async () => {
    const setIncludeArchived = jest.fn();
    mockUseAccounts.mockReturnValue(baseAccounts({ setIncludeArchived }));
    await render(<FinanceAccountsScreen />);

    await fireEvent.press(screen.getByTestId('accounts-archived-toggle'));
    expect(setIncludeArchived).toHaveBeenCalledWith(true);

    expect(screen.getByText('No accounts yet')).toBeTruthy();
  });
});
