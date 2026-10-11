import { anchorDayOf, nextOccurrenceDate, pendingOccurrenceDates } from '@/utils/recurrence';

describe('nextOccurrenceDate', () => {
  it('adds whole weeks for weekly recurrence', () => {
    expect(nextOccurrenceDate('2026-10-01', 'weekly', 1)).toBe('2026-10-08');
    expect(nextOccurrenceDate('2026-12-29', 'weekly', 29)).toBe('2027-01-05');
  });

  it('adds calendar months for monthly recurrence', () => {
    expect(nextOccurrenceDate('2026-10-15', 'monthly', 15)).toBe('2026-11-15');
    expect(nextOccurrenceDate('2026-12-15', 'monthly', 15)).toBe('2027-01-15');
  });

  it('clamps to the target month length and returns to the anchor day', () => {
    // Anchored on the 31st: Feb is clamped, March comes back to the 31st.
    expect(nextOccurrenceDate('2026-01-31', 'monthly', 31)).toBe('2026-02-28');
    expect(nextOccurrenceDate('2026-02-28', 'monthly', 31)).toBe('2026-03-31');
    // 2028 is a leap year.
    expect(nextOccurrenceDate('2028-01-31', 'monthly', 31)).toBe('2028-02-29');
    expect(nextOccurrenceDate('2028-02-29', 'monthly', 31)).toBe('2028-03-31');
  });

  it('adds three months for quarterly recurrence with month-end clamping', () => {
    expect(nextOccurrenceDate('2026-11-30', 'quarterly', 30)).toBe('2027-02-28');
    expect(nextOccurrenceDate('2027-02-28', 'quarterly', 30)).toBe('2027-05-30');
  });

  it('adds a year for yearly recurrence, honoring Feb 29 anchors', () => {
    expect(nextOccurrenceDate('2026-06-15', 'yearly', 15)).toBe('2027-06-15');
    expect(nextOccurrenceDate('2028-02-29', 'yearly', 29)).toBe('2029-02-28');
    expect(nextOccurrenceDate('2031-02-28', 'yearly', 29)).toBe('2032-02-29');
  });

  it('returns null for one-off bills', () => {
    expect(nextOccurrenceDate('2026-10-01', 'none', 1)).toBeNull();
  });
});

describe('anchorDayOf', () => {
  it('reads the day-of-month from a calendar date', () => {
    expect(anchorDayOf('2026-10-01')).toBe(1);
    expect(anchorDayOf('2026-10-31')).toBe(31);
  });
});

describe('pendingOccurrenceDates', () => {
  const base = {
    firstDueOn: '2026-10-15',
    recurrence: 'monthly' as const,
    installmentCount: null,
    lastDueOn: null,
    existingCount: 0,
    horizonOn: '2026-12-11',
  };

  it('materializes the anchor and later dates up to the horizon', () => {
    expect(pendingOccurrenceDates(base)).toEqual(['2026-10-15', '2026-11-15']);
  });

  it('always materializes the first occurrence even beyond the horizon', () => {
    expect(
      pendingOccurrenceDates({ ...base, firstDueOn: '2028-01-01' }),
    ).toEqual(['2028-01-01']);
  });

  it('continues from the last materialized date', () => {
    expect(
      pendingOccurrenceDates({
        ...base,
        lastDueOn: '2026-11-15',
        existingCount: 2,
        horizonOn: '2026-12-31',
      }),
    ).toEqual(['2026-12-15']);
  });

  it('does not materialize the next date when it is beyond the horizon', () => {
    expect(
      pendingOccurrenceDates({
        ...base,
        lastDueOn: '2026-11-15',
        existingCount: 2,
      }),
    ).toEqual([]);
  });

  it('materializes nothing when everything up to the horizon exists', () => {
    expect(
      pendingOccurrenceDates({
        ...base,
        lastDueOn: '2026-12-15',
        existingCount: 3,
      }),
    ).toEqual([]);
  });

  it('produces catch-up occurrences for a past anchor', () => {
    expect(
      pendingOccurrenceDates({
        ...base,
        firstDueOn: '2026-08-31',
        horizonOn: '2026-10-20',
      }),
    ).toEqual(['2026-08-31', '2026-09-30']);
  });

  it('stops at the installment count even with past dates', () => {
    expect(
      pendingOccurrenceDates({
        ...base,
        firstDueOn: '2026-06-10',
        installmentCount: 3,
        horizonOn: '2026-12-11',
      }),
    ).toEqual(['2026-06-10', '2026-07-10', '2026-08-10']);
  });

  it('respects the remaining installment count after existing ones', () => {
    expect(
      pendingOccurrenceDates({
        ...base,
        firstDueOn: '2026-06-10',
        installmentCount: 12,
        lastDueOn: '2026-11-10',
        existingCount: 6,
        horizonOn: '2026-12-11',
      }),
    ).toEqual(['2026-12-10']);
  });

  it('materializes a single occurrence for one-off bills', () => {
    expect(
      pendingOccurrenceDates({ ...base, recurrence: 'none' }),
    ).toEqual(['2026-10-15']);
    expect(
      pendingOccurrenceDates({
        ...base,
        recurrence: 'none',
        lastDueOn: '2026-10-15',
        existingCount: 1,
      }),
    ).toEqual([]);
  });

  it('walks a monthly schedule across a year boundary', () => {
    expect(
      pendingOccurrenceDates({
        ...base,
        firstDueOn: '2026-12-05',
        horizonOn: '2027-02-20',
      }),
    ).toEqual(['2026-12-05', '2027-01-05', '2027-02-05']);
  });
});
