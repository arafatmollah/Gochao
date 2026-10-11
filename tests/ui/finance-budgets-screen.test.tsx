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

jest.mock('@/components/confirm', () => ({
  confirmDestructive: jest.fn(),
}));

jest.mock('@/features/finance/hooks/use-budgets');
jest.mock('@/features/finance/hooks/use-budget-form');

import { router } from 'expo-router';
import FinanceBudgetsScreen from '@/app/finance-budgets';
import BudgetFormScreen from '@/app/budget-form';
import { confirmDestructive } from '@/components/confirm';
import { useBudgetForm } from '@/features/finance/hooks/use-budget-form';
import { useBudgets } from '@/features/finance/hooks/use-budgets';

import { makeBudgetWithUsage, makeCategoryWithUsage } from '../helpers/factories';

const mockPush = router.push as jest.Mock;
const mockBack = router.back as jest.Mock;
const mockUseBudgets = useBudgets as jest.Mock;
const mockUseBudgetForm = useBudgetForm as jest.Mock;
const mockConfirmDestructive = confirmDestructive as jest.Mock;

describe('FinanceBudgetsScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('lists budgets with derived usage and opens them', async () => {
    mockUseBudgets.mockReturnValue({
      budgets: [
        makeBudgetWithUsage({
          id: 'budget-1',
          categoryId: 'cat_expense_food',
          categoryName: 'Food',
          amountMinor: 300_000,
          spentMinor: 200_000,
        }),
        makeBudgetWithUsage({
          id: 'budget-2',
          categoryId: 'cat_expense_transport',
          categoryName: 'Transport',
          amountMinor: 100_000,
          spentMinor: 150_000,
        }),
      ],
      monthKey: '2026-10',
      loading: false,
      refreshing: false,
      error: null,
      refresh: jest.fn(),
    });
    await render(<FinanceBudgetsScreen />);

    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getByText('Spent ৳2,000 of ৳3,000')).toBeTruthy();
    expect(screen.getByText('৳1,000 left')).toBeTruthy();
    expect(screen.getByText('Spent ৳1,500 of ৳1,000')).toBeTruthy();
    expect(screen.getByText('Over by ৳500')).toBeTruthy();
    expect(screen.getByText('Over budget')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('budget-row-budget-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/budget-form', params: { id: 'budget-1' } });

    await fireEvent.press(screen.getByTestId('add-budget-fab'));
    expect(mockPush).toHaveBeenCalledWith('/budget-form');
  });

  it('shows the empty state with an add action', async () => {
    mockUseBudgets.mockReturnValue({
      budgets: [],
      monthKey: '2026-10',
      loading: false,
      refreshing: false,
      error: null,
      refresh: jest.fn(),
    });
    await render(<FinanceBudgetsScreen />);

    expect(screen.getByText('No budgets yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add a budget'));
    expect(mockPush).toHaveBeenCalledWith('/budget-form');
  });
});

describe('BudgetFormScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockConfirmDestructive.mockReset();
  });

  function baseForm(overrides: Record<string, unknown> = {}) {
    return {
      isEdit: false,
      loadState: 'ready',
      loadError: null,
      retryLoad: jest.fn(),
      availableCategories: [],
      lockedCategory: null,
      categoryId: null,
      chooseCategory: jest.fn(),
      amountText: '',
      setAmountText: jest.fn(),
      amountError: null,
      formError: null,
      saving: false,
      deleting: false,
      submit: jest.fn(async () => true),
      remove: jest.fn(async () => true),
      ...overrides,
    };
  }

  it('creates a budget for a chosen category', async () => {
    const submit = jest.fn(async () => true);
    const chooseCategory = jest.fn();
    mockUseBudgetForm.mockReturnValue(
      baseForm({
        availableCategories: [
          makeCategoryWithUsage({ id: 'cat_expense_food', name: 'Food' }),
          makeCategoryWithUsage({ id: 'cat_expense_rent', name: 'Rent' }),
        ],
        categoryId: 'cat_expense_food',
        amountText: '10000',
        submit,
        chooseCategory,
      }),
    );
    await render(<BudgetFormScreen />);

    expect(screen.getByText('Add budget')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('budget-category-cat_expense_rent'));
    expect(chooseCategory).toHaveBeenCalledWith('cat_expense_rent');

    await fireEvent.press(screen.getByTestId('save-budget-button'));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('blocks creation when every expense category is already budgeted', async () => {
    mockUseBudgetForm.mockReturnValue(baseForm());
    await render(<BudgetFormScreen />);

    expect(screen.getByText('Every expense category already has a budget.')).toBeTruthy();
    expect(screen.getByTestId('save-budget-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('edits the amount of a locked category and deletes after confirmation', async () => {
    const remove = jest.fn(async () => true);
    const setAmountText = jest.fn();
    mockUseBudgetForm.mockReturnValue(
      baseForm({
        isEdit: true,
        lockedCategory: { id: 'cat_expense_food', name: 'Food', isBuiltin: true },
        categoryId: 'cat_expense_food',
        amountText: '10000',
        setAmountText,
        remove,
      }),
    );
    await render(<BudgetFormScreen />);

    expect(screen.getByText('Save changes')).toBeTruthy();
    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.queryByTestId('budget-category-cat_expense_rent')).toBeNull();

    mockConfirmDestructive.mockResolvedValue(false);
    await fireEvent.press(screen.getByTestId('delete-budget-button'));
    await waitFor(() => expect(mockConfirmDestructive).toHaveBeenCalled());
    expect(remove).not.toHaveBeenCalled();

    mockConfirmDestructive.mockResolvedValue(true);
    await fireEvent.press(screen.getByTestId('delete-budget-button'));
    await waitFor(() => expect(remove).toHaveBeenCalled());
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
