import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router');
jest.mock('@/features/bills/hooks/use-bills');

import { router } from 'expo-router';
import BillsScreen from '@/app/(tabs)/bills';
import { buildDueSections } from '@/features/bills/grouping';
import { useBills } from '@/features/bills/hooks/use-bills';

import { makeBillDueItem, makeBillSummary } from '../helpers/factories';

const mockPush = router.push as jest.Mock;
const mockUseBills = useBills as jest.Mock;

const TODAY = '2026-10-11';

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    segment: 'due',
    setSegment: jest.fn(),
    dueSections: [],
    dueCount: 0,
    overdueCount: 0,
    summaries: [],
    history: [],
    historyHasMore: false,
    today: TODAY,
    loading: false,
    refreshing: false,
    loadingMore: false,
    error: null,
    notice: null,
    clearNotice: jest.fn(),
    refresh: jest.fn(),
    loadMoreHistory: jest.fn(),
    ...overrides,
  };
}

describe('BillsScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('groups due occurrences and shows the overdue summary in the header', async () => {
    const overdue = makeBillDueItem({
      id: 'occ-over',
      billId: 'bill-rent',
      billName: 'House rent',
      billCategory: 'rent',
      dueOn: '2026-10-01',
      expectedAmountMinor: 1_500_000,
    });
    const dueToday = makeBillDueItem({
      id: 'occ-today',
      billId: 'bill-net',
      billName: 'Internet',
      dueOn: TODAY,
      expectedAmountMinor: 125_000,
    });
    const due = [overdue, dueToday];

    mockUseBills.mockReturnValue(
      baseHookState({
        dueSections: buildDueSections(due, TODAY),
        dueCount: due.length,
        overdueCount: 1,
      }),
    );
    await render(<BillsScreen />);

    expect(screen.getByText('Bills & installments')).toBeTruthy();
    expect(screen.getByText('2 due · 1 overdue')).toBeTruthy();

    expect(screen.getByText('Overdue')).toBeTruthy();
    expect(screen.getByText('House rent')).toBeTruthy();
    expect(screen.getByText('Internet')).toBeTruthy();
    // Once as the "Today" section header, once as the due card's relative date.
    expect(screen.getAllByText('Today')).toHaveLength(2);
    expect(screen.getByText('Expected ৳15,000')).toBeTruthy();
    expect(screen.getByText('Expected ৳1,250')).toBeTruthy();
    expect(screen.getAllByText('Record payment')).toHaveLength(2);
  });

  it('opens the bill detail from a card and the payment screen from its action', async () => {
    const item = makeBillDueItem({
      id: 'occ-1',
      billId: 'bill-1',
      billName: 'Internet',
      dueOn: TODAY,
    });
    mockUseBills.mockReturnValue(
      baseHookState({
        dueSections: buildDueSections([item], TODAY),
        dueCount: 1,
      }),
    );
    await render(<BillsScreen />);

    await fireEvent.press(screen.getByTestId('bill-due-occ-1'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/bill-detail',
      params: { id: 'bill-1' },
    });

    await fireEvent.press(screen.getByText('Record payment'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/bill-pay',
      params: { occurrenceId: 'occ-1' },
    });
  });

  it('switches segments through the chips', async () => {
    const setSegment = jest.fn();
    mockUseBills.mockReturnValue(baseHookState({ setSegment }));
    await render(<BillsScreen />);

    await fireEvent.press(screen.getByTestId('bills-segment-bills'));
    expect(setSegment).toHaveBeenCalledWith('bills');

    await fireEvent.press(screen.getByTestId('bills-segment-history'));
    expect(setSegment).toHaveBeenCalledWith('history');
  });

  it('shows an honest empty state when nothing is due', async () => {
    mockUseBills.mockReturnValue(baseHookState());
    await render(<BillsScreen />);

    expect(screen.getByText('No bills due')).toBeTruthy();
    expect(screen.getByText('Bills due in the coming weeks will appear here.')).toBeTruthy();
  });

  it('lists bills with schedule facts and opens the detail or the add form', async () => {
    const summary = makeBillSummary({
      id: 'bill-desco',
      name: 'DESCO',
      category: 'electricity',
      recurrence: 'monthly',
      nextDueOn: '2026-10-20',
    });
    mockUseBills.mockReturnValue(
      baseHookState({ segment: 'bills', summaries: [summary] }),
    );
    await render(<BillsScreen />);

    expect(screen.getByText('DESCO')).toBeTruthy();
    expect(screen.getByText('Electricity')).toBeTruthy();
    expect(screen.getByText('Monthly')).toBeTruthy();
    expect(screen.getByText(/Next due/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('bill-row-bill-desco'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/bill-detail',
      params: { id: 'bill-desco' },
    });
  });

  it('offers adding a bill from the empty bills list', async () => {
    mockUseBills.mockReturnValue(baseHookState({ segment: 'bills' }));
    await render(<BillsScreen />);

    expect(screen.getByText('No bills yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add a bill'));
    expect(mockPush).toHaveBeenCalledWith('/bill-form');
  });

  it('shows recorded payments in history and navigates to the bill', async () => {
    const payment = makeBillDueItem({
      id: 'occ-paid',
      billId: 'bill-rent',
      billName: 'House rent',
      billCategory: 'rent',
      status: 'paid',
      dueOn: '2026-10-01',
      paidOn: '2026-10-03',
      paidAmountMinor: 1_500_000,
    });
    mockUseBills.mockReturnValue(baseHookState({ segment: 'history', history: [payment] }));
    await render(<BillsScreen />);

    expect(screen.getByText('House rent')).toBeTruthy();
    // The date line ("Paid October 3, 2026") and the amount line ("Paid ৳…").
    expect(screen.getAllByText(/^Paid /)).toHaveLength(2);
    expect(screen.getByText('Paid ৳15,000')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('bill-history-occ-paid'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/bill-detail',
      params: { id: 'bill-rent' },
    });
  });

  it('opens the bill form from the FAB', async () => {
    mockUseBills.mockReturnValue(baseHookState());
    await render(<BillsScreen />);

    await fireEvent.press(screen.getByTestId('add-bill-fab'));
    expect(mockPush).toHaveBeenCalledWith('/bill-form');
  });

  it('surfaces load errors with a retry action', async () => {
    const refresh = jest.fn();
    mockUseBills.mockReturnValue(
      baseHookState({ error: 'Could not access the database. Please try again.', refresh }),
    );
    await render(<BillsScreen />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(refresh).toHaveBeenCalled();
  });

  it('shows a transient banner for failed actions', async () => {
    mockUseBills.mockReturnValue(baseHookState({ notice: 'This bill no longer exists.' }));
    await render(<BillsScreen />);

    expect(screen.getByText('This bill no longer exists.')).toBeTruthy();
  });
});
