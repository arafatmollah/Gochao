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
  useLocalSearchParams: jest.fn(() => ({ occurrenceId: 'occ-1' })),
}));

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/features/bills/hooks/use-bill-pay');

import { router, useLocalSearchParams } from 'expo-router';
import BillPayScreen from '@/app/bill-pay';
import { useBillPay } from '@/features/bills/hooks/use-bill-pay';
import { addDaysIsoDate, todayIsoDate } from '@/utils/dates';

import { makeAccount, makeBillDueItem } from '../helpers/factories';

const mockRouter = router as unknown as {
  push: jest.Mock;
  back: jest.Mock;
  replace: jest.Mock;
  canGoBack: jest.Mock;
};
const mockUseBillPay = useBillPay as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;

const TODAY = todayIsoDate();

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    loadState: 'ready',
    loadError: null,
    retryLoad: jest.fn(),
    occurrence: makeBillDueItem({
      id: 'occ-1',
      billId: 'bill-1',
      billName: 'Internet',
      dueOn: '2026-10-11',
      expectedAmountMinor: 125_000,
    }),
    amountText: '1250',
    setAmountText: jest.fn(),
    amountError: null,
    paidOn: '2026-10-11',
    setPaidOn: jest.fn(),
    paidOnError: null,
    accounts: [],
    accountChoice: undefined,
    setAccountChoice: jest.fn(),
    accountId: null,
    formError: null,
    saving: false,
    submit: jest.fn(),
    ...overrides,
  };
}

describe('BillPayScreen', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    mockRouter.back.mockClear();
    mockRouter.replace.mockClear();
    mockRouter.canGoBack.mockReturnValue(true);
    mockParams.mockReturnValue({ occurrenceId: 'occ-1' });
  });

  it('shows the offline-only disclaimer, the occurrence context and prefilled fields', async () => {
    mockUseBillPay.mockReturnValue(baseHookState());
    await render(<BillPayScreen />);

    expect(
      screen.getByText('Jibon only records this payment on this device — it does not pay the biller.'),
    ).toBeTruthy();
    expect(screen.getByText('Internet')).toBeTruthy();
    expect(screen.getByText('Expected ৳1,250')).toBeTruthy();

    expect(screen.getByTestId('pay-amount-input').props.value).toBe('1250');
    expect(screen.getByTestId('pay-date-input').props.value).toBe('2026-10-11');
    // No accounts exist, so the picker stays hidden and nothing is filed.
    expect(screen.queryByText('Pay from account')).toBeNull();
  });

  it('offers an account picker, including a way to skip account tracking', async () => {
    const setAccountChoice = jest.fn();
    mockUseBillPay.mockReturnValue(
      baseHookState({
        accounts: [
          makeAccount({ id: 'acc-1', name: 'Cash' }),
          makeAccount({ id: 'acc-2', name: 'Bank', type: 'bank' }),
        ],
        accountId: 'acc-1',
        setAccountChoice,
      }),
    );
    await render(<BillPayScreen />);

    expect(screen.getByText('Pay from account')).toBeTruthy();
    expect(
      screen.getByText('This payment is also filed as an expense from this account.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('pay-account-chip-acc-2'));
    expect(setAccountChoice).toHaveBeenCalledWith('acc-2');

    await fireEvent.press(screen.getByTestId('pay-account-none-chip'));
    expect(setAccountChoice).toHaveBeenCalledWith(null);
  });

  it('records the payment once and returns to the previous screen', async () => {
    const submit = jest.fn().mockResolvedValue(true);
    mockUseBillPay.mockReturnValue(baseHookState({ submit }));
    await render(<BillPayScreen />);

    await fireEvent.press(screen.getByTestId('record-payment-button'));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('stays on the screen when recording fails validation', async () => {
    const submit = jest.fn().mockResolvedValue(false);
    mockUseBillPay.mockReturnValue(baseHookState({ submit }));
    await render(<BillPayScreen />);

    await fireEvent.press(screen.getByTestId('record-payment-button'));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('renders the translated amount validation error from the hook code', async () => {
    mockUseBillPay.mockReturnValue(
      baseHookState({ amountText: '0', amountError: 'bill_paid_amount_invalid' }),
    );
    await render(<BillPayScreen />);

    expect(screen.getByText('Enter a valid paid amount greater than zero.')).toBeTruthy();
  });

  it('offers today and yesterday quick date chips', async () => {
    const setPaidOn = jest.fn();
    mockUseBillPay.mockReturnValue(baseHookState({ setPaidOn }));
    await render(<BillPayScreen />);

    await fireEvent.press(screen.getByText('Yesterday'));
    expect(setPaidOn).toHaveBeenCalledWith(addDaysIsoDate(TODAY, -1));

    await fireEvent.press(screen.getByText('Today'));
    expect(setPaidOn).toHaveBeenCalledWith(TODAY);
  });

  it('shows a load error with retry when the occurrence cannot be loaded', async () => {
    const retryLoad = jest.fn();
    mockUseBillPay.mockReturnValue(
      baseHookState({
        loadState: 'error',
        loadError: 'This bill no longer exists.',
        retryLoad,
      }),
    );
    await render(<BillPayScreen />);

    expect(screen.getByText('This bill no longer exists.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(retryLoad).toHaveBeenCalled();
  });

  it('returns to the bills tab when there is no history to go back to', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    mockUseBillPay.mockReturnValue(baseHookState());
    await render(<BillPayScreen />);

    await fireEvent.press(screen.getByTestId('cancel-payment-button'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/bills');
  });
});
