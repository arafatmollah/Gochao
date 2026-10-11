import { buildDashboardFinance } from '@/features/dashboard/finance-summary';
import { buildDashboardSummary } from '@/features/dashboard/summary';

describe('buildDashboardSummary', () => {
  it('derives todayTotal and progress from the stored counts', () => {
    const summary = buildDashboardSummary({
      pendingDueCount: 3,
      overdueCount: 1,
      dueTodayCount: 2,
      completedTodayCount: 1,
    });

    expect(summary.todayTotal).toBe(4);
    expect(summary.progress).toBe(0.25);
    expect(summary.pendingDueCount).toBe(3);
    expect(summary.overdueCount).toBe(1);
    expect(summary.dueTodayCount).toBe(2);
    expect(summary.completedTodayCount).toBe(1);
  });

  it('reports zero progress when nothing is tracked today', () => {
    const summary = buildDashboardSummary({
      pendingDueCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      completedTodayCount: 0,
    });

    expect(summary.todayTotal).toBe(0);
    expect(summary.progress).toBe(0);
  });

  it('reaches full progress when everything tracked today is done', () => {
    const summary = buildDashboardSummary({
      pendingDueCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      completedTodayCount: 5,
    });

    expect(summary.todayTotal).toBe(5);
    expect(summary.progress).toBe(1);
  });
});

describe('buildDashboardFinance', () => {
  it('derives the month net and total balance from stored figures', () => {
    const finance = buildDashboardFinance({
      todayExpenseMinor: 25_000,
      monthIncomeMinor: 500_000,
      monthExpenseMinor: 320_000,
      accountBalances: [100_000, 45_500],
    });

    expect(finance.monthNetMinor).toBe(180_000);
    expect(finance.totalBalanceMinor).toBe(145_500);
    expect(finance.accountCount).toBe(2);
    expect(finance.todayExpenseMinor).toBe(25_000);
  });

  it('reports zeroes for an empty install', () => {
    const finance = buildDashboardFinance({
      todayExpenseMinor: 0,
      monthIncomeMinor: 0,
      monthExpenseMinor: 0,
      accountBalances: [],
    });

    expect(finance.monthNetMinor).toBe(0);
    expect(finance.totalBalanceMinor).toBe(0);
    expect(finance.accountCount).toBe(0);
  });
});
