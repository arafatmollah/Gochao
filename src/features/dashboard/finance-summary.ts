/**
 * Dashboard money figures, derived only from stored records (master prompt
 * rule: never hardcode financial balances or dashboard statistics). Pure math
 * so the screen and tests share one source of truth.
 */

export interface DashboardFinanceInput {
  /** Expense total for today's local calendar day. */
  todayExpenseMinor: number;
  monthIncomeMinor: number;
  monthExpenseMinor: number;
  /** Derived balance of every account (opening ± activity). */
  accountBalances: readonly number[];
}

export interface DashboardFinance {
  todayExpenseMinor: number;
  monthIncomeMinor: number;
  monthExpenseMinor: number;
  /** income − expense for the month; transfers never count. */
  monthNetMinor: number;
  totalBalanceMinor: number;
  accountCount: number;
}

export function buildDashboardFinance(input: DashboardFinanceInput): DashboardFinance {
  const totalBalanceMinor = input.accountBalances.reduce((sum, balance) => sum + balance, 0);
  return {
    todayExpenseMinor: input.todayExpenseMinor,
    monthIncomeMinor: input.monthIncomeMinor,
    monthExpenseMinor: input.monthExpenseMinor,
    monthNetMinor: input.monthIncomeMinor - input.monthExpenseMinor,
    totalBalanceMinor,
    accountCount: input.accountBalances.length,
  };
}

export const EMPTY_DASHBOARD_FINANCE: DashboardFinance = buildDashboardFinance({
  todayExpenseMinor: 0,
  monthIncomeMinor: 0,
  monthExpenseMinor: 0,
  accountBalances: [],
});
