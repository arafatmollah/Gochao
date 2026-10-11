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

jest.mock('@/features/finance/hooks/use-finance-reports', () => ({
  useFinanceReports: jest.fn(),
  REPORT_RANGES: ['daily', 'weekly', 'monthly', 'yearly'],
}));

import { router } from 'expo-router';
import FinanceReportsScreen from '@/app/finance-reports';
import { useFinanceReports } from '@/features/finance/hooks/use-finance-reports';

import { makeAccountWithBalance, makeBudgetWithUsage } from '../helpers/factories';

const mockPush = router.push as jest.Mock;
const mockUseFinanceReports = useFinanceReports as jest.Mock;

function baseState(overrides: Record<string, unknown> = {}) {
  return {
    range: 'monthly',
    setRange: jest.fn(),
    loading: false,
    refreshing: false,
    error: null,
    refresh: jest.fn(),
    totals: { incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
    expenseByCategory: [],
    accountBalances: [],
    savingsSeries: [],
    budgetUsage: [],
    hasData: false,
    ...overrides,
  };
}

const SAVINGS_SERIES = [
  { monthKey: '2026-05', incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
  { monthKey: '2026-06', incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
  { monthKey: '2026-07', incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
  { monthKey: '2026-08', incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
  { monthKey: '2026-09', incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
  { monthKey: '2026-10', incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
];

describe('FinanceReportsScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('shows an honest empty state before anything is recorded', async () => {
    mockUseFinanceReports.mockReturnValue(baseState());
    await render(<FinanceReportsScreen />);

    expect(screen.getByText('Nothing to report yet')).toBeTruthy();
    expect(screen.queryByTestId('reports-summary')).toBeNull();
  });

  it('renders derived totals, breakdowns, budgets and balances', async () => {
    mockUseFinanceReports.mockReturnValue(
      baseState({
        hasData: true,
        totals: { incomeMinor: 500_000, expenseMinor: 300_000, netMinor: 200_000 },
        expenseByCategory: [
          {
            categoryId: 'cat_expense_food',
            categoryName: 'Food',
            categoryIsBuiltin: true,
            totalMinor: 200_000,
          },
          {
            categoryId: 'cat_expense_transport',
            categoryName: 'Transport',
            categoryIsBuiltin: true,
            totalMinor: 100_000,
          },
        ],
        savingsSeries: SAVINGS_SERIES,
        budgetUsage: [
          makeBudgetWithUsage({
            id: 'budget-1',
            categoryId: 'cat_expense_food',
            categoryName: 'Food',
            amountMinor: 300_000,
            spentMinor: 200_000,
          }),
        ],
        accountBalances: [
          makeAccountWithBalance({ id: 'acc-1', name: 'Cash', balanceMinor: 100_000 }),
        ],
      }),
    );
    await render(<FinanceReportsScreen />);

    const summary = screen.getByTestId('reports-summary');
    expect(within(summary).getByText('৳5,000')).toBeTruthy();
    expect(within(summary).getByText('৳3,000')).toBeTruthy();
    expect(within(summary).getByText('৳2,000')).toBeTruthy();

    // Largest categories highlight plus the full breakdown with shares.
    expect(screen.getAllByText('Food').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Transport').length).toBeGreaterThan(0);
    expect(screen.getByText('67%')).toBeTruthy();
    expect(screen.getByText('33%')).toBeTruthy();

    // Six-month savings chart with one bar per month.
    expect(screen.getByTestId('savings-bar-2026-10')).toBeTruthy();
    expect(screen.getByTestId('savings-bar-2026-05')).toBeTruthy();

    // Budget usage renders and opens the budget form.
    expect(screen.getByText('Spent ৳2,000 of ৳3,000')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('report-budget-budget-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/budget-form', params: { id: 'budget-1' } });

    expect(screen.getByTestId('report-account-acc-1')).toBeTruthy();
  });

  it('switches the range through the chips', async () => {
    const setRange = jest.fn();
    mockUseFinanceReports.mockReturnValue(
      baseState({
        hasData: true,
        setRange,
        savingsSeries: SAVINGS_SERIES,
      }),
    );
    await render(<FinanceReportsScreen />);

    await fireEvent.press(screen.getByTestId('report-range-daily'));
    expect(setRange).toHaveBeenCalledWith('daily');
    await fireEvent.press(screen.getByTestId('report-range-yearly'));
    expect(setRange).toHaveBeenCalledWith('yearly');

    // With no expenses this period, the breakdown says so instead of faking one.
    expect(screen.getByText('No expenses recorded in this period.')).toBeTruthy();
    expect(screen.getByText('No budgets set yet.')).toBeTruthy();
    expect(screen.getByText('No accounts to show.')).toBeTruthy();
  });
});
