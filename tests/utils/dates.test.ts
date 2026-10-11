import {
  addDaysIsoDate,
  addMonthsToKey,
  daysBetweenIsoDates,
  isMonthKey,
  isValidIsoDate,
  localDayBoundsIso,
  monthBoundsForKey,
  monthKeyOf,
  parseIsoDate,
  toIsoDate,
  todayIsoDate,
  yearBoundsOf,
} from '@/utils/dates';

describe('date helpers', () => {
  describe('toIsoDate', () => {
    it('formats a local date as YYYY-MM-DD with zero padding', () => {
      expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(toIsoDate(new Date(2026, 9, 11))).toBe('2026-10-11');
    });

    it('todayIsoDate matches toIsoDate for the current date', () => {
      expect(todayIsoDate()).toBe(toIsoDate(new Date()));
    });
  });

  describe('isValidIsoDate', () => {
    it('accepts real dates', () => {
      expect(isValidIsoDate('2026-10-11')).toBe(true);
      expect(isValidIsoDate('2028-02-29')).toBe(true);
    });

    it('rejects malformed strings', () => {
      expect(isValidIsoDate('2026-1-1')).toBe(false);
      expect(isValidIsoDate('11/10/2026')).toBe(false);
      expect(isValidIsoDate('2026-10-11T00:00:00Z')).toBe(false);
      expect(isValidIsoDate('')).toBe(false);
    });

    it('rejects impossible calendar dates', () => {
      expect(isValidIsoDate('2026-02-30')).toBe(false);
      expect(isValidIsoDate('2026-13-01')).toBe(false);
      expect(isValidIsoDate('2027-02-29')).toBe(false);
    });
  });

  describe('parseIsoDate', () => {
    it('parses to local midnight', () => {
      const date = parseIsoDate('2026-10-11');
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(9);
      expect(date?.getDate()).toBe(11);
      expect(date?.getHours()).toBe(0);
    });

    it('returns null for invalid input', () => {
      expect(parseIsoDate('nope')).toBeNull();
    });
  });

  describe('addDaysIsoDate', () => {
    it('crosses month and year boundaries', () => {
      expect(addDaysIsoDate('2026-10-31', 1)).toBe('2026-11-01');
      expect(addDaysIsoDate('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDaysIsoDate('2026-01-01', -1)).toBe('2025-12-31');
    });

    it('handles leap years', () => {
      expect(addDaysIsoDate('2028-02-28', 1)).toBe('2028-02-29');
      expect(addDaysIsoDate('2028-02-29', 1)).toBe('2028-03-01');
    });

    it('throws on invalid input', () => {
      expect(() => addDaysIsoDate('bad', 1)).toThrow();
    });
  });

  describe('daysBetweenIsoDates', () => {
    it('counts whole days across month boundaries', () => {
      expect(daysBetweenIsoDates('2026-10-11', '2026-11-11')).toBe(31);
      expect(daysBetweenIsoDates('2026-10-11', '2026-10-10')).toBe(-1);
      expect(daysBetweenIsoDates('2026-10-11', '2026-10-11')).toBe(0);
    });
  });

  describe('localDayBoundsIso', () => {
    it('returns the UTC instants delimiting the local calendar day (end exclusive)', () => {
      const { startIso, endIso } = localDayBoundsIso(new Date(2026, 9, 11, 15, 30, 0));

      expect(startIso).toBe(new Date(2026, 9, 11, 0, 0, 0).toISOString());
      expect(endIso).toBe(new Date(2026, 9, 12, 0, 0, 0).toISOString());
    });

    it('is stable for any time within the same local day', () => {
      const morning = localDayBoundsIso(new Date(2026, 9, 11, 6, 15, 0));
      const night = localDayBoundsIso(new Date(2026, 9, 11, 23, 59, 59));
      expect(morning).toEqual(night);
    });

    it('rolls over at month boundaries', () => {
      const { startIso, endIso } = localDayBoundsIso(new Date(2026, 9, 31, 0, 0, 1));
      expect(startIso).toBe(new Date(2026, 9, 31).toISOString());
      expect(endIso).toBe(new Date(2026, 10, 1).toISOString());
    });
  });

  describe('month keys and bounds', () => {
    it('monthKeyOf extracts the key from a valid date and throws otherwise', () => {
      expect(monthKeyOf('2026-10-11')).toBe('2026-10');
      expect(monthKeyOf('2026-01-01')).toBe('2026-01');
      expect(() => monthKeyOf('not-a-date')).toThrow();
    });

    it('isMonthKey validates the shape and month range', () => {
      expect(isMonthKey('2026-10')).toBe(true);
      expect(isMonthKey('2026-01')).toBe(true);
      expect(isMonthKey('2026-13')).toBe(false);
      expect(isMonthKey('2026-00')).toBe(false);
      expect(isMonthKey('2026-1')).toBe(false);
      expect(isMonthKey('2026-10-11')).toBe(false);
    });

    it('addMonthsToKey crosses year boundaries in both directions', () => {
      expect(addMonthsToKey('2026-10', 1)).toBe('2026-11');
      expect(addMonthsToKey('2026-12', 1)).toBe('2027-01');
      expect(addMonthsToKey('2026-01', -1)).toBe('2025-12');
      expect(addMonthsToKey('2026-10', 0)).toBe('2026-10');
      expect(addMonthsToKey('2026-10', -14)).toBe('2025-08');
      expect(() => addMonthsToKey('bad', 1)).toThrow();
    });

    it('monthBoundsForKey returns first, last, and exclusive next day', () => {
      expect(monthBoundsForKey('2026-10')).toEqual({
        startOn: '2026-10-01',
        lastOn: '2026-10-31',
        nextStartOn: '2026-11-01',
      });
      expect(monthBoundsForKey('2026-02')).toEqual({
        startOn: '2026-02-01',
        lastOn: '2026-02-28',
        nextStartOn: '2026-03-01',
      });
      expect(monthBoundsForKey('2028-02').lastOn).toBe('2028-02-29');
      expect(() => monthBoundsForKey('2026-13')).toThrow();
    });

    it('yearBoundsOf returns the calendar year bounds (exclusive end)', () => {
      expect(yearBoundsOf('2026-10-11')).toEqual({
        startOn: '2026-01-01',
        nextStartOn: '2027-01-01',
      });
      expect(() => yearBoundsOf('bad')).toThrow();
    });
  });
});
