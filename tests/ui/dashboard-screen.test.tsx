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
// Reanimated drives the prayer widget's entrance and progress animations.
// Its bundled mock pulls native worklets, so stub the small surface we use.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chainable = {
    duration: () => chainable,
    delay: () => chainable,
  };
  return {
    __esModule: true,
    default: { View },
    FadeInUp: chainable,
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    withTiming: (toValue: unknown) => toValue,
    withRepeat: (value: unknown) => value,
  };
});

import { router } from 'expo-router';
import DashboardScreen from '@/app/(tabs)/index';
import { buildDashboardFinance } from '@/features/dashboard/finance-summary';
import { useDashboard } from '@/features/dashboard/hooks/use-dashboard';
import { buildDashboardSummary } from '@/features/dashboard/summary';

import {
  makeBillDueItem,
  makeDueDose,
  makeFamilyRequestListItem,
  makeNote,
  makePrayerDay,
  makeTask,
} from '../helpers/factories';

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
    recentNotes: [],
    openFamilyRequests: [],
    openRequestCount: 0,
    prayerDay: null,
    dueDoses: [],
    today: '2026-10-11',
    loading: false,
    refreshing: false,
    error: null,
    notice: null,
    clearNotice: jest.fn(),
    refresh: jest.fn(),
    toggleComplete: jest.fn(),
    toggleNotePin: jest.fn(),
    logDose: jest.fn(),
    clearDose: jest.fn(),
    ...overrides,
  };
}

describe('DashboardScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('greets the user and shows the hero card without an empty task card', async () => {
    mockUseDashboard.mockReturnValue(baseHookState());
    await render(<DashboardScreen />);

    expect(screen.getByText(/Good (morning|afternoon|evening)/)).toBeTruthy();

    const hero = screen.getByTestId('dashboard-hero');
    expect(within(hero).getByText('Nothing due today')).toBeTruthy();
    // The "nothing due" card was removed: no task CTA on an empty home.
    expect(screen.queryByText('Tasks due today or overdue will show up here.')).toBeNull();
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

    await fireEvent.press(screen.getByTestId('quick-add-family-request'));
    expect(mockPush).toHaveBeenCalledWith('/request-form');
  });

  it('opens universal search from the header button', async () => {
    mockUseDashboard.mockReturnValue(baseHookState());
    await render(<DashboardScreen />);

    await fireEvent.press(screen.getByTestId('dashboard-search-button'));
    expect(mockPush).toHaveBeenCalledWith('/search');
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

  it('previews the most recently modified notes and opens them', async () => {
    const toggleNotePin = jest.fn();
    const note = makeNote({ id: 'note-3', title: 'Rent receipts', content: 'Keep every receipt' });
    mockUseDashboard.mockReturnValue(
      baseHookState({ recentNotes: [note], toggleNotePin }),
    );
    await render(<DashboardScreen />);

    expect(screen.getByTestId('dashboard-notes-header')).toBeTruthy();
    expect(screen.getByText('Rent receipts')).toBeTruthy();
    expect(screen.getByText('Keep every receipt')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('dashboard-note-note-3-pin'));
    expect(toggleNotePin).toHaveBeenCalledWith(note);

    await fireEvent.press(screen.getByTestId('dashboard-note-note-3'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/note-form', params: { id: 'note-3' } });

    await fireEvent.press(screen.getByTestId('dashboard-see-all-notes'));
    expect(mockPush).toHaveBeenCalledWith('/notes');
  });

  it('hides the notes section when nothing has been written yet', async () => {
    mockUseDashboard.mockReturnValue(baseHookState());
    await render(<DashboardScreen />);

    expect(screen.queryByTestId('dashboard-notes-header')).toBeNull();
    expect(screen.queryByTestId('dashboard-see-all-notes')).toBeNull();
  });

  it('previews outstanding family requests and opens the family module', async () => {
    const request = makeFamilyRequestListItem({ id: 'req-5', title: 'Buy insulin' });
    mockUseDashboard.mockReturnValue(baseHookState({ openFamilyRequests: [request] }));
    await render(<DashboardScreen />);

    expect(screen.getByTestId('dashboard-family-header')).toBeTruthy();
    expect(screen.getByText('Buy insulin')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('dashboard-family-request-req-5'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/request-form', params: { id: 'req-5' } });

    await fireEvent.press(screen.getByTestId('dashboard-see-all-family'));
    expect(mockPush).toHaveBeenCalledWith('/family');
  });

  it('hides the family section when no requests are outstanding', async () => {
    mockUseDashboard.mockReturnValue(baseHookState());
    await render(<DashboardScreen />);

    expect(screen.queryByTestId('dashboard-family-header')).toBeNull();
    expect(screen.queryByTestId('dashboard-see-all-family')).toBeNull();
  });

  it('shows the prayer widget with the current prayer window and opens the prayer module', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 11, 10, 0, 0));
    try {
      mockUseDashboard.mockReturnValue(baseHookState({ prayerDay: makePrayerDay() }));
      await render(<DashboardScreen />);

      const widget = screen.getByTestId('dashboard-prayer-widget');
      // At the faked 10:00 clock Fajr (from 4:45 AM) is active until Dhuhr.
      expect(within(widget).getByText('Current prayer')).toBeTruthy();
      // The active prayer name appears in the headline and in the day strip.
      expect(within(widget).getAllByText('Fajr')).toHaveLength(2);
      expect(within(widget).getByText('4:45 AM – 12:00 PM')).toBeTruthy();
      // Live stopwatch countdown to the window end (Dhuhr) from the faked 10:00 clock.
      const timer = within(widget).getByTestId('dashboard-prayer-timer');
      expect(within(timer).getByText('02:00:00')).toBeTruthy();
      expect(within(timer).getByText('left')).toBeTruthy();
      expect(within(widget).getByText('1 of 6 prayed')).toBeTruthy();

      await fireEvent.press(widget);
      expect(mockPush).toHaveBeenCalledWith('/prayer');
    } finally {
      jest.useRealTimers();
    }
  });

  it('hides the prayer widget when the schedule is unavailable', async () => {
    mockUseDashboard.mockReturnValue(baseHookState({ prayerDay: null }));
    await render(<DashboardScreen />);

    expect(screen.queryByTestId('dashboard-prayer-widget')).toBeNull();
  });

  it('shows the restricted state instead of prayers during a pause window', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 11, 15, 10, 0));
    try {
      mockUseDashboard.mockReturnValue(
        baseHookState({
          prayerDay: makePrayerDay(),
          prayerRestricted: [{ id: 'after-asr', start: '15:00', end: '15:30' }],
        }),
      );
      await render(<DashboardScreen />);

      const widget = screen.getByTestId('dashboard-prayer-widget');
      expect(within(widget).getByText('Restricted time')).toBeTruthy();
      expect(within(widget).getByText('3:00 PM – 3:30 PM')).toBeTruthy();
      // Countdown runs to the pause end from the faked 15:10 clock.
      const timer = within(widget).getByTestId('dashboard-prayer-timer');
      expect(within(timer).getByText('00:20:00')).toBeTruthy();
      // The day strip still renders underneath for context.
      expect(within(widget).getByText('Fajr')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('previews today’s doses with logging actions and opens health', async () => {
    const logDose = jest.fn();
    const dose = makeDueDose({ scheduleId: 'sch-9', medicineName: 'Napa' });
    mockUseDashboard.mockReturnValue(baseHookState({ dueDoses: [dose], logDose }));
    await render(<DashboardScreen />);

    expect(screen.getByTestId('dashboard-doses-header')).toBeTruthy();
    expect(screen.getByText('Napa')).toBeTruthy();
    expect(screen.getByText('1 tablet')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('dashboard-dose-sch-9-taken'));
    expect(logDose).toHaveBeenCalledWith(dose, 'taken');

    await fireEvent.press(screen.getByTestId('dashboard-dose-sch-9-skipped'));
    expect(logDose).toHaveBeenCalledWith(dose, 'skipped');

    await fireEvent.press(screen.getByTestId('dashboard-see-all-health'));
    expect(mockPush).toHaveBeenCalledWith('/health');
  });

  it('hides the doses section when nothing is due today', async () => {
    mockUseDashboard.mockReturnValue(baseHookState({ dueDoses: [] }));
    await render(<DashboardScreen />);

    expect(screen.queryByTestId('dashboard-doses-header')).toBeNull();
    expect(screen.queryByTestId('dashboard-see-all-health')).toBeNull();
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
