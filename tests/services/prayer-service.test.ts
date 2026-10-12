import { SqlitePrayerRepository } from '@/db/repositories/prayer-repository';
import { createPrayerService, type PrayerService } from '@/services/prayer-service';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

/** Deterministic clock: each call returns the next timestamp in a fixed sequence. */
function createTickClock(startSeconds = 0): () => string {
  let tick = startSeconds;
  return () => {
    const iso = `2026-10-11T08:00:${String(tick).padStart(2, '0')}.000Z`;
    tick += 1;
    return iso;
  };
}

describe('PrayerService', () => {
  let db: TestDatabase;
  let service: PrayerService;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    service = createPrayerService(new SqlitePrayerRepository(db), { now: createTickClock() });
  });

  afterEach(() => {
    db.close();
  });

  describe('settings', () => {
    it('returns Dhaka defaults before the first save', async () => {
      const settings = await service.getSettings();

      expect(settings).toMatchObject({
        calculationMethod: 'karachi',
        madhab: 'hanafi',
        latitude: 23.8103,
        longitude: 90.4125,
        cityLabel: 'Dhaka',
        updatedAt: null,
      });
    });

    it('saves and merges settings', async () => {
      const saved = await service.updateSettings({ cityLabel: '  Cumilla  ' });
      expect(saved.cityLabel).toBe('Cumilla');
      expect(saved.updatedAt).not.toBeNull();
      expect(saved.remindersEnabled).toBe(false);

      const merged = await service.updateSettings({ madhab: 'shafi' });
      expect(merged.madhab).toBe('shafi');
      expect(merged.cityLabel).toBe('Cumilla');
      expect(merged.calculationMethod).toBe('karachi');
    });

    it('persists the UTC offset and rejects out-of-range values', async () => {
      expect((await service.updateSettings({ utcOffsetMinutes: 330 })).utcOffsetMinutes).toBe(
        330,
      );
      expect((await service.getSettings()).utcOffsetMinutes).toBe(330);
      await expect(service.updateSettings({ utcOffsetMinutes: 841 })).rejects.toMatchObject({
        code: 'validation',
      });
      await expect(service.updateSettings({ utcOffsetMinutes: 5.5 })).rejects.toMatchObject({
        code: 'validation',
      });
    });

    it('persists the reminders flag across saves', async () => {

      expect((await service.updateSettings({ remindersEnabled: true })).remindersEnabled).toBe(
        true,
      );
      expect((await service.getSettings()).remindersEnabled).toBe(true);
      expect((await service.updateSettings({ cityLabel: 'Dhaka' })).remindersEnabled).toBe(true);
      expect((await service.updateSettings({ remindersEnabled: false })).remindersEnabled).toBe(
        false,
      );
    });

    it('rejects out-of-range coordinates and bad enums', async () => {
      await expect(service.updateSettings({ latitude: 91 })).rejects.toMatchObject({
        code: 'validation',
      });
      await expect(service.updateSettings({ longitude: -181 })).rejects.toMatchObject({
        code: 'validation',
      });
      await expect(
        service.updateSettings({ calculationMethod: 'nasa' as never }),
      ).rejects.toMatchObject({ code: 'validation' });
      await expect(service.updateSettings({ adjustments: { fajr: 61 } })).rejects.toMatchObject({
        code: 'validation',
      });
    });
  });

  describe('schedules', () => {
    it('calculates, caches, and reuses a day', async () => {
      const first = await service.getDay('2026-10-12');
      expect(first.prayers).toHaveLength(5);
      expect(first.prayers.map((entry) => entry.status)).toEqual([null, null, null, null, null]);

      const second = await service.getDay('2026-10-12');
      expect(second).toEqual(first);

      const cached = await db.getAllAsync<{ date: string; prayer: string }>(
        'SELECT date, prayer FROM prayer_day_times WHERE date = ?',
        ['2026-10-12'],
      );
      expect(cached).toHaveLength(5);
    });

    it('recalculates when settings change', async () => {
      const before = await service.getDay('2026-10-12');
      await service.updateSettings({ madhab: 'shafi' });
      const after = await service.getDay('2026-10-12');

      const asrBefore = before.prayers.find((entry) => entry.prayer === 'asr')?.time;
      const asrAfter = after.prayers.find((entry) => entry.prayer === 'asr')?.time;
      expect(asrAfter).not.toBe(asrBefore);
    });

    it('rejects invalid dates', async () => {
      await expect(service.getDay('tomorrow')).rejects.toMatchObject({ code: 'validation' });
      await expect(service.getHistory('2026-10-12', 0)).rejects.toMatchObject({
        code: 'validation',
      });
    });

    it('returns ordered history with statuses', async () => {
      await service.logPrayer('2026-10-11', 'fajr', 'prayed');
      await service.logPrayer('2026-10-12', 'fajr', 'missed');

      const history = await service.getHistory('2026-10-12', 2);
      expect(history.map((day) => day.date)).toEqual(['2026-10-11', '2026-10-12']);
      expect(history[0].prayers.find((entry) => entry.prayer === 'fajr')?.status).toBe('prayed');
      expect(history[1].prayers.find((entry) => entry.prayer === 'fajr')?.status).toBe('missed');
      expect(history[1].prayers.find((entry) => entry.prayer === 'dhuhr')?.status).toBeNull();
    });
  });

  describe('logs', () => {
    it('logs, updates, and clears a prayer', async () => {
      const logged = await service.logPrayer('2026-10-12', 'fajr', 'prayed');
      expect(logged.status).toBe('prayed');

      const updated = await service.logPrayer('2026-10-12', 'fajr', 'missed');
      expect(updated.status).toBe('missed');

      const day = await service.getDay('2026-10-12');
      expect(day.prayers.find((entry) => entry.prayer === 'fajr')?.status).toBe('missed');

      expect(await service.clearLog('2026-10-12', 'fajr')).toBe(true);
      expect(await service.clearLog('2026-10-12', 'fajr')).toBe(false);
    });

    it('validates log input', async () => {
      await expect(service.logPrayer('bad-date', 'fajr', 'prayed')).rejects.toMatchObject({
        code: 'validation',
      });
      await expect(
        service.logPrayer('2026-10-12', 'sunrise' as never, 'prayed'),
      ).rejects.toMatchObject({ code: 'validation' });
      await expect(
        service.logPrayer('2026-10-12', 'fajr', 'skipped' as never),
      ).rejects.toMatchObject({ code: 'validation' });
    });
  });
});
