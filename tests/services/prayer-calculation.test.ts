import { calculateDayTimes, findNextPrayer, minutesUntil } from '@/services/prayer-calculation';
import { defaultPrayerSettings } from '@/db/repositories/prayer-repository';
import { isDayPrayer } from '@/types/prayer';

const DHAKA = {
  ...defaultPrayerSettings(),
  cityLabel: 'Dhaka',
  updatedAt: null,
};

describe('prayer calculation (adhan, offline)', () => {
  it('calculates exact Dhaka wall times regardless of device timezone', () => {
    // These instants are fixed astronomy; rendering through the +360 offset
    // must yield Dhaka wall times on any device (CI runs in UTC).
    expect(calculateDayTimes('2026-10-12', DHAKA).map((entry) => entry.time)).toEqual([
      '04:39',
      '11:46',
      '15:57',
      '17:35',
      '18:50',
    ]);
  });

  it('shifts wall times with the UTC offset setting', () => {
    const utc = calculateDayTimes('2026-10-12', { ...DHAKA, utcOffsetMinutes: 0 });
    expect(utc.map((entry) => entry.time)).toEqual([
      '22:39',
      '05:46',
      '09:57',
      '11:35',
      '12:50',
    ]);
  });

  it('calculates five ordered wall-clock times for Dhaka', () => {
    const times = calculateDayTimes('2026-10-12', DHAKA);

    expect(times.map((entry) => entry.prayer)).toEqual([
      'fajr',
      'dhuhr',
      'asr',
      'maghrib',
      'isha',
    ]);
    for (const entry of times) {
      expect(entry.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    }
    const minutes = times.map((entry) => {
      const [hours, mins] = entry.time.split(':').map(Number);
      return hours * 60 + mins;
    });
    for (let i = 1; i < minutes.length; i += 1) {
      expect(minutes[i]).toBeGreaterThan(minutes[i - 1]);
    }
  });

  it('is deterministic for the same day and settings', () => {
    expect(calculateDayTimes('2026-10-12', DHAKA)).toEqual(
      calculateDayTimes('2026-10-12', DHAKA),
    );
  });

  it('shifts times with manual adjustments', () => {
    const base = calculateDayTimes('2026-10-12', DHAKA);
    const adjusted = calculateDayTimes('2026-10-12', {
      ...DHAKA,
      adjustments: { fajr: 10, dhuhr: 0, asr: 0, maghrib: 0, isha: -5 },
    });

    const toMinutes = (time: string) => {
      const [hours, mins] = time.split(':').map(Number);
      return hours * 60 + mins;
    };
    expect(toMinutes(adjusted[0].time) - toMinutes(base[0].time)).toBe(10);
    expect(toMinutes(adjusted[4].time) - toMinutes(base[4].time)).toBe(-5);
  });

  it('changes Asr with the madhab', () => {
    const hanafi = calculateDayTimes('2026-10-12', DHAKA);
    const shafi = calculateDayTimes('2026-10-12', { ...DHAKA, madhab: 'shafi' });

    expect(shafi[2].time).not.toBe(hanafi[2].time);
    expect(shafi.filter((entry, i) => entry.prayer !== 'asr').map((e) => e.time)).toEqual(
      hanafi.filter((entry) => entry.prayer !== 'asr').map((e) => e.time),
    );
  });

  it('rejects invalid dates and coordinates', () => {
    expect(() => calculateDayTimes('not-a-date', DHAKA)).toThrow();
    expect(() =>
      calculateDayTimes('2026-10-12', { ...DHAKA, latitude: Number.NaN }),
    ).toThrow();
  });
});

describe('isDayPrayer', () => {
  it('marks Dhuhr and Asr as day prayers, the rest as night prayers', () => {
    expect(isDayPrayer('dhuhr')).toBe(true);
    expect(isDayPrayer('asr')).toBe(true);
    expect(isDayPrayer('fajr')).toBe(false);
    expect(isDayPrayer('maghrib')).toBe(false);
    expect(isDayPrayer('isha')).toBe(false);
  });
});

describe('findNextPrayer', () => {
  const times = [
    { prayer: 'fajr', time: '04:45' },
    { prayer: 'dhuhr', time: '12:00' },
    { prayer: 'asr', time: '15:30' },
    { prayer: 'maghrib', time: '18:10' },
    { prayer: 'isha', time: '19:30' },
  ] as const;

  it('finds the first prayer still in the future', () => {
    expect(findNextPrayer([...times], '03:00')).toBe('fajr');
    expect(findNextPrayer([...times], '04:45')).toBe('dhuhr');
    expect(findNextPrayer([...times], '18:00')).toBe('maghrib');
  });

  it('returns null after Isha', () => {
    expect(findNextPrayer([...times], '19:30')).toBeNull();
    expect(findNextPrayer([...times], '23:59')).toBeNull();
  });

  it('measures minutes between wall-clock times', () => {
    expect(minutesUntil('18:00', '18:10')).toBe(10);
    expect(minutesUntil('bad', '18:10')).toBeNull();
  });
});
