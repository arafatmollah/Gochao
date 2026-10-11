/**
 * Dashboard figures, derived only from stored records (master prompt rule:
 * never hardcode financial balances or dashboard statistics). Pure math so
 * the screen and tests share one source of truth.
 */

export interface DashboardSummaryInput {
  /** Pending tasks due today or overdue. */
  pendingDueCount: number;
  /** Pending tasks whose due date is before today. */
  overdueCount: number;
  /** Pending tasks due exactly today. */
  dueTodayCount: number;
  /** Tasks completed during today's local calendar day. */
  completedTodayCount: number;
}

export interface DashboardSummary extends DashboardSummaryInput {
  /** Pending + completed today — the denominator of the progress bar. */
  todayTotal: number;
  /** Completed share of today's total, 0..1 (0 when nothing is tracked). */
  progress: number;
}

export function buildDashboardSummary(input: DashboardSummaryInput): DashboardSummary {
  const todayTotal = input.pendingDueCount + input.completedTodayCount;
  const progress = todayTotal > 0 ? input.completedTodayCount / todayTotal : 0;
  return { ...input, todayTotal, progress };
}
