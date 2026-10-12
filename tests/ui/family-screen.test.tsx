import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router');
jest.mock('@/features/family/hooks/use-family', () => ({
  ...jest.requireActual('@/features/family/hooks/use-family'),
  useFamily: jest.fn(),
}));

import { router } from 'expo-router';
import FamilyScreen from '@/app/family';
import { useFamily } from '@/features/family/hooks/use-family';

import { makeFamilyRequestListItem } from '../helpers/factories';
import type { FamilyMember } from '@/types/family';

const mockPush = router.push as jest.Mock;
const mockBack = router.back as jest.Mock;
const mockReplace = router.replace as jest.Mock;
const mockCanGoBack = router.canGoBack as jest.Mock;
const mockUseFamily = useFamily as jest.Mock;

function makeMember(overrides: Partial<FamilyMember> = {}): FamilyMember {
  return {
    id: 'member-1',
    name: 'Ayesha',
    relationship: 'spouse',
    contact: null,
    notes: null,
    isArchived: false,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    segment: 'requests',
    setSegment: jest.fn(),
    statusFilter: 'all',
    setStatusFilter: jest.fn(),
    memberFilterId: null,
    setMemberFilterId: jest.fn(),
    search: '',
    setSearch: jest.fn(),
    requests: [],
    members: [],
    filterMembers: [],
    loading: false,
    refreshing: false,
    error: null,
    notice: null,
    clearNotice: jest.fn(),
    refresh: jest.fn(),
    setRequestStatus: jest.fn(),
    generateTask: jest.fn(),
    removeRequest: jest.fn(),
    toggleMemberArchive: jest.fn(),
    removeMember: jest.fn(),
    ...overrides,
  };
}

describe('FamilyScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.mockReset();
  });

  it('goes back from the header, falling back to More with no history', async () => {
    mockUseFamily.mockReturnValue(baseHookState());
    mockCanGoBack.mockReturnValue(true);
    await render(<FamilyScreen />);

    await fireEvent.press(screen.getByTestId('family-header-back'));
    expect(mockBack).toHaveBeenCalled();

    mockCanGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByTestId('family-header-back'));
    expect(mockReplace).toHaveBeenCalledWith('/more');
  });

  it('lists requests with status and member filter chips', async () => {
    const request = makeFamilyRequestListItem({
      id: 'req-1',
      title: 'Buy insulin',
      memberName: 'Baba',
      deadline: '2026-10-20',
      estimatedCostMinor: 45_000,
    });
    const member = makeMember({ id: 'member-9', name: 'Baba', relationship: 'father' });
    mockUseFamily.mockReturnValue(
      baseHookState({ requests: [request], members: [member], filterMembers: [member] }),
    );
    await render(<FamilyScreen />);

    expect(screen.getByTestId('family-header')).toBeTruthy();
    expect(screen.getByText('Buy insulin')).toBeTruthy();
    expect(screen.getByTestId('family-status-all')).toBeTruthy();
    expect(screen.getByTestId('family-status-open')).toBeTruthy();
    expect(screen.getByTestId('family-status-in_progress')).toBeTruthy();
    expect(screen.getByTestId('family-status-done')).toBeTruthy();
    expect(screen.getByTestId('family-status-cancelled')).toBeTruthy();
    expect(screen.getByTestId('family-member-filter-member-9')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('family-request-req-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/request-form', params: { id: 'req-1' } });

    await fireEvent.press(screen.getByTestId('add-family-fab'));
    expect(mockPush).toHaveBeenCalledWith('/request-form');
  });

  it('shows the request empty state with an add action when there is nothing yet', async () => {
    mockUseFamily.mockReturnValue(baseHookState());
    await render(<FamilyScreen />);

    expect(screen.getByText('No family requests yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add family request'));
    expect(mockPush).toHaveBeenCalledWith('/request-form');
  });

  it('updates the status filter when a status chip is pressed', async () => {
    const setStatusFilter = jest.fn();
    mockUseFamily.mockReturnValue(baseHookState({ setStatusFilter }));
    await render(<FamilyScreen />);

    await fireEvent.press(screen.getByTestId('family-status-in_progress'));
    expect(setStatusFilter).toHaveBeenCalledWith('in_progress');
  });

  it('filters by member when a member chip is pressed', async () => {
    const member = makeMember({ id: 'member-9', name: 'Baba' });
    const setMemberFilterId = jest.fn();
    mockUseFamily.mockReturnValue(
      baseHookState({ members: [member], filterMembers: [member], setMemberFilterId }),
    );
    await render(<FamilyScreen />);

    await fireEvent.press(screen.getByTestId('family-member-filter-member-9'));
    expect(setMemberFilterId).toHaveBeenCalledWith('member-9');
  });

  it('lists members with relationship labels and opens the member form', async () => {
    const member = makeMember({ id: 'member-1', name: 'Ayesha', relationship: 'spouse' });
    const archived = makeMember({ id: 'member-2', name: 'Chacha', relationship: 'other', isArchived: true });
    mockUseFamily.mockReturnValue(
      baseHookState({
        segment: 'members',
        members: [member, archived],
        filterMembers: [member],
      }),
    );
    await render(<FamilyScreen />);

    expect(screen.getByTestId('family-segment-members')).toBeTruthy();
    expect(screen.getByText('Ayesha')).toBeTruthy();
    expect(screen.getByText('Spouse')).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('family-member-member-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/member-form', params: { id: 'member-1' } });

    await fireEvent.press(screen.getByTestId('add-family-fab'));
    expect(mockPush).toHaveBeenCalledWith('/member-form');
  });

  it('switches segments through the segment chips', async () => {
    const setSegment = jest.fn();
    mockUseFamily.mockReturnValue(baseHookState({ setSegment }));
    await render(<FamilyScreen />);

    await fireEvent.press(screen.getByTestId('family-segment-members'));
    expect(setSegment).toHaveBeenCalledWith('members');
  });

  it('shows the members empty state with an add action', async () => {
    mockUseFamily.mockReturnValue(baseHookState({ segment: 'members' }));
    await render(<FamilyScreen />);

    expect(screen.getByText('No members yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add member'));
    expect(mockPush).toHaveBeenCalledWith('/member-form');
  });

  it('shows the filtered empty state when filters match nothing', async () => {
    mockUseFamily.mockReturnValue(baseHookState({ statusFilter: 'done' }));
    await render(<FamilyScreen />);

    expect(screen.getByText('No matching requests')).toBeTruthy();
    expect(screen.queryByText('No family requests yet')).toBeNull();
  });

  it('surfaces load errors with a retry action', async () => {
    const refresh = jest.fn();
    mockUseFamily.mockReturnValue(
      baseHookState({ error: 'Could not access the database. Please try again.', refresh }),
    );
    await render(<FamilyScreen />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('Try again'));
    });
    expect(refresh).toHaveBeenCalled();
  });
});
