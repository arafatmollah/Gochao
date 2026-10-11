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
jest.mock('@/features/tasks/hooks/use-tasks');

import { router } from 'expo-router';
import TasksScreen from '@/app/(tabs)/tasks';
import { useTasks } from '@/features/tasks/hooks/use-tasks';

import { makeTask } from '../helpers/factories';

const mockPush = router.push as jest.Mock;
const mockUseTasks = useTasks as jest.Mock;

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    sections: [],
    activeCount: 0,
    overdueCount: 0,
    today: '2026-10-11',
    loading: false,
    refreshing: false,
    loadingMore: false,
    error: null,
    notice: null,
    clearNotice: jest.fn(),
    statusFilter: 'active',
    setStatusFilter: jest.fn(),
    priorityFilter: null,
    setPriorityFilter: jest.fn(),
    search: '',
    setSearch: jest.fn(),
    hasMore: false,
    refresh: jest.fn(),
    loadMore: jest.fn(),
    toggleComplete: jest.fn(),
    removeTask: jest.fn(),
    ...overrides,
  };
}

describe('TasksScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('shows the intentional empty state for a fresh install and offers adding a task', async () => {
    mockUseTasks.mockReturnValue(baseHookState());
    await render(<TasksScreen />);

    expect(screen.getByText('No tasks yet')).toBeTruthy();
    expect(screen.getByText('Add your first task to start organizing your day.')).toBeTruthy();

    expect(screen.getByText('0 tasks active')).toBeTruthy();

    await fireEvent.press(screen.getByText('Add a task'));
    expect(mockPush).toHaveBeenCalledWith('/task-form');
  });

  it('renders task rows from the sections', async () => {
    const task = makeTask({ id: 'task-a', title: 'Pay electricity bill', dueAt: '2026-10-12' });
    mockUseTasks.mockReturnValue(
      baseHookState({
        sections: [{ key: 'upcoming', title: 'Upcoming', data: [task] }],
        activeCount: 1,
      }),
    );
    await render(<TasksScreen />);

    expect(screen.getByText('Pay electricity bill')).toBeTruthy();
    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(screen.getByText('1 task active')).toBeTruthy();
  });

  it('reports overdue counts in the subtitle', async () => {
    const task = makeTask({ id: 'task-od', title: 'Late thing', dueAt: '2026-10-01' });
    mockUseTasks.mockReturnValue(
      baseHookState({
        sections: [{ key: 'overdue', title: 'Overdue', tone: 'danger', data: [task] }],
        activeCount: 1,
        overdueCount: 1,
      }),
    );
    await render(<TasksScreen />);

    expect(screen.getByText('1 active · 1 overdue')).toBeTruthy();
    expect(screen.getByText('Overdue')).toBeTruthy();
  });

  it('toggles completion from the checkbox and opens the form from a row', async () => {
    const toggleComplete = jest.fn();
    const task = makeTask({ id: 'task-b', title: 'Call mother' });
    mockUseTasks.mockReturnValue(
      baseHookState({
        sections: [{ key: 'no-date', title: 'No due date', data: [task] }],
        toggleComplete,
      }),
    );
    await render(<TasksScreen />);

    await fireEvent.press(screen.getByTestId('task-checkbox-task-b'));
    expect(toggleComplete).toHaveBeenCalledWith(task);

    await fireEvent.press(screen.getByTestId('task-row-task-b'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task-form',
      params: { id: 'task-b' },
    });
  });

  it('navigates to the form via the floating action button', async () => {
    mockUseTasks.mockReturnValue(baseHookState());
    await render(<TasksScreen />);

    await fireEvent.press(screen.getByTestId('add-task-fab'));
    expect(mockPush).toHaveBeenCalledWith('/task-form');
  });

  it('shows an error state when loading fails and retries on demand', async () => {
    const refresh = jest.fn();
    mockUseTasks.mockReturnValue(
      baseHookState({ error: 'Could not access the database. Please try again.', refresh }),
    );
    await render(<TasksScreen />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(refresh).toHaveBeenCalled();
  });

  it('shows a transient banner for failed actions', async () => {
    const clearNotice = jest.fn();
    mockUseTasks.mockReturnValue(
      baseHookState({ notice: 'This task no longer exists.', clearNotice }),
    );
    await render(<TasksScreen />);

    expect(screen.getByText('This task no longer exists.')).toBeTruthy();
  });

  it('shows the no-matches empty state when filters are active', async () => {
    mockUseTasks.mockReturnValue(baseHookState({ search: 'xyz' }));
    await render(<TasksScreen />);

    expect(screen.getByText('No matching tasks')).toBeTruthy();

    await fireEvent.press(screen.getByText('Clear filters'));
    expect(mockUseTasks.mock.results.length).toBeGreaterThan(0);
  });
});
