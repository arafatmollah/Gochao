import { fireEvent, render, screen, within } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router');
jest.mock('@/features/dashboard/hooks/use-dashboard');

import { router } from 'expo-router';
import DashboardScreen from '@/app/(tabs)/index';
import { buildDashboardFinance } from '@/features/dashboard/finance-summary';
import { useDashboard } from '@/features/dashboard/hooks/use-dashboard';
import { buildDashboardSummary } from '@/features/dashboard/summary';

import { makeBillDueItem, makeTask } from '../helpers/factories';

const mockPush = router.push as jest.Mock;
const mockUseDashboard = useDashboard as jest.Mock;

const EMPTY_SUMMARY = buildDashboardSummary({
  pendingDueCount: 0,
  overdueCount: 0,
  dueTodayCount: 0,
  completedTodayCount: 0,
});

const EMPTY_FINANCE = buildDashboardFinance({
  todayExpenseMinor: 0,
  monthIncomeMinor: 0,
  monthExpenseMinor: 0,
  accountBalances: [],
});

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    summary: EMPTY_SUMMARY,
    finance: EMPTY_FINANCE,
    tasks: [],
    upcomingBills: [],
    today: '2026-10-11',
    loading: false,
    refreshing: false,
    error: null,
    notice: null,
    clearNotice: jest.fn(),
    refresh: jest.fn(),
    toggleComplete: jest.fn(),
    ...overrides,
  };
}

describe('DashboardScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('greets the user and shows the hero card with an honest empty state', async () => {
    mockUseDashboard.mockReturnValue(baseHookState());
    await render(<DashboardScreen />);

    expect(screen.getByText(/Good (morning|afternoon|evening)/)).toBeTruthy();

    const hero = screen.getByTestId('dashboard-hero');
    expect(within(hero).getByText('Nothing due today')).toBeTruthy();
    expect(screen.getByText('Tasks due today or overdue will show up here.')).toBeTruthy();
  });

  it('navigates to the task form and the money forms from the quick actions and FAB', async () => {
    mockUseDashboard.mockReturnValue(baseHookState());
    await render(<DashboardScreen />);

    await fireEvent.press(screen.getByTestId('dashboard-add-task-fab'));
    expect(mockPush).toHaveBeenCalledWith('/task-form');

    await fireEvent.press(screen.getByTestId('quick-add-income'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction-form',
      params: { kind: 'income' },
    });

    await fireEvent.press(screen.getByTestId('quick-add-expense'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction-form',
      params: { kind: 'expense' },
    });

    await fireEvent.press(screen.getByTestId('quick-view-bills'));
    expect(mockPush).toHaveBeenCalledWith('/bills');
  });

  it('shows the money card with derived figures and opens the finance tab', async () => {
    mockUseDashboard.mockReturnValue(
      baseHookState({
        finance: buildDashboardFinance({
          todayExpenseMinor: 25_000,
          monthIncomeMinor: 500_000,
          monthExpenseMinor: 320_000,
          accountBalances: [100_000, 45_500],
        }),
      }),
    );
    await render(<DashboardScreen />);

    const card = screen.getByTestId('dashboard-finance-card');
    expect(within(card).getByText('Money this month')).toBeTruthy();
    expect(within(card).getByText('Total balance')).toBeTruthy();
    expect(within(card).getByText('৳1,455')).toBeTruthy();
    expect(within(card).getByText('৳5,000')).toBeTruthy();
    expect(within(card).getByText('৳3,200')).toBeTruthy();
    expect(within(card).getByText('৳1,800')).toBeTruthy();
    expect(within(card).getByText('Spent today ৳250')).toBeTruthy();

    await fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith('/finance');
  });

  it('previews upcoming bills with expected amounts and opens the bill detail', async () => {
    const bill = makeBillDueItem({
      id: 'occ-9',
      billId: 'bill-7',
      billName: 'Internet',
      dueOn: '2026-10-11',
      expectedAmountMinor: 125_000,
    });
    mockUseDashboard.mockReturnValue(baseHookState({ upcomingBills: [bill] }));
    await render(<DashboardScreen />);

    expect(screen.getByText('Upcoming bills')).toBeTruthy();
    expect(screen.getByText('Internet')).toBeTruthy();
    expect(screen.getByText('Expected ৳1,250')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('dashboard-bill-occ-9'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/bill-detail',
      params: { id: 'bill-7' },
    });

    await fireEvent.press(screen.getByTestId('dashboard-see-all-bills'));
    expect(mockPush).toHaveBeenCalledWith('/bills');
  });

  it('hides the bills section when no bills are due', async () => {
    mockUseDashboard.mockReturnValue(baseHookState());
    await render(<DashboardScreen />);

    expect(screen.queryByText('Upcoming bills')).toBeNull();
  });

  it('renders real summary figures and the due tasks', async () => {
    const toggleComplete = jest.fn();
    const overdue = makeTask({ id: 'od-1', title: 'Pay electricity bill', dueAt: '2026-10-01' });
    const dueToday = makeTask({ id: 'td-1', title: 'Call mother', dueAt: '2026-10-11' });

    mockUseDashboard.mockReturnValue(
      baseHookState({
        summary: buildDashboardSummary({
          pendingDueCount: 2,
          overdueCount: 1,
          dueTodayCount: 1,
          completedTodayCount: 2,
        }),
        tasks: [overdue, dueToday],
        toggleComplete,
      }),
    );
    await render(<DashboardScreen />);

    const hero = screen.getByTestId('dashboard-hero');
    expect(within(hero).getByText('2')).toBeTruthy();
    expect(within(hero).getByText('50% done')).toBeTruthy();
    expect(within(hero).getByText('still to do today')).toBeTruthy();

    expect(screen.getByText('Pay electricity bill')).toBeTruthy();
    expect(screen.getByText('Call mother')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('task-checkbox-od-1'));
    expect(toggleComplete).toHaveBeenCalledWith(overdue);

    await fireEvent.press(screen.getByTestId('dashboard-see-all'));
    expect(mockPush).toHaveBeenCalledWith('/tasks');
  });

  it('surfaces load errors with a retry action', async () => {
    const refresh = jest.fn();
    mockUseDashboard.mockReturnValue(
      baseHookState({ error: 'Could not access the database. Please try again.', refresh }),
    );
    await render(<DashboardScreen />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(refresh).toHaveBeenCalled();
  });

  it('shows a transient banner for failed actions', async () => {
    mockUseDashboard.mockReturnValue(
      baseHookState({ notice: 'This task no longer exists.' }),
    );
    await render(<DashboardScreen />);

    expect(screen.getByText('This task no longer exists.')).toBeTruthy();
  });
});
