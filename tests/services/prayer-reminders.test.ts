import {
  cancelPrayerReminders,
  enablePrayerReminders,
  PRAYER_REMINDER_CHANNEL_ID,
  reminderIdentifier,
  scheduleDailyPrayerReminders,
  type ReminderScheduler,
} from '@/services/prayer-reminders';

interface ScheduledCall {
  identifier: string;
  title: string;
  hour: number;
  minute: number;
  channelId?: string;
}

function makeScheduler(
  overrides: Partial<ReminderScheduler> = {},
  granted = true,
): ReminderScheduler & {
  scheduled: ScheduledCall[];
  cancelled: string[];
  channels: { id: string; channel: { name: string; importance: number } }[];
  getHandlerBehavior: () => Promise<Record<string, boolean> | undefined>;
} {
  let registeredHandler: { handleNotification: () => Promise<Record<string, boolean>> } | undefined;
  const state = {
    scheduled: [] as ScheduledCall[],
    cancelled: [] as string[],
    channels: [] as { id: string; channel: { name: string; importance: number } }[],
    granted,
  };
  return {
    scheduled: state.scheduled,
    cancelled: state.cancelled,
    channels: state.channels,
    getHandlerBehavior: async () => registeredHandler?.handleNotification(),
    getPermissionsAsync: async () => ({ granted: state.granted }),
    requestPermissionsAsync: async () => ({ granted: state.granted }),
    setNotificationChannelAsync: async (id, channel) => {
      state.channels.push({ id, channel });
    },
    setNotificationHandler: (handler) => {
      registeredHandler = handler;
    },
    scheduleNotificationAsync: async (request) => {
      const trigger = request.trigger;
      state.scheduled.push({
        identifier: request.identifier,
        title: request.content.title,
        hour: trigger.hour,
        minute: trigger.minute,
        channelId: trigger.channelId,
      });
      return request.identifier;
    },
    cancelScheduledNotificationAsync: async (identifier) => {
      state.cancelled.push(identifier);
    },
    ...overrides,
  };
}

const ENTRIES = [
  { prayer: 'fajr', time: '04:45', texts: { title: 'Fajr', body: '4:45 AM' } },
  { prayer: 'dhuhr', time: '12:00', texts: { title: 'Dhuhr', body: '12:00 PM' } },
  { prayer: 'asr', time: '15:30', texts: { title: 'Asr', body: '3:30 PM' } },
  { prayer: 'maghrib', time: '18:10', texts: { title: 'Maghrib', body: '6:10 PM' } },
  { prayer: 'isha', time: '19:30', texts: { title: 'Isha', body: '7:30 PM' } },
] as const;

describe('prayer reminders', () => {
  it('schedules five daily notifications with stable identifiers', async () => {
    const scheduler = makeScheduler();
    await scheduleDailyPrayerReminders([...ENTRIES], scheduler);

    expect(scheduler.scheduled).toHaveLength(5);
    expect(scheduler.scheduled.map((call) => call.identifier)).toEqual([
      'jibon-prayer-fajr',
      'jibon-prayer-dhuhr',
      'jibon-prayer-asr',
      'jibon-prayer-maghrib',
      'jibon-prayer-isha',
    ]);
    expect(scheduler.scheduled[0]).toMatchObject({
      title: 'Fajr',
      hour: 4,
      minute: 45,
      channelId: PRAYER_REMINDER_CHANNEL_ID,
    });
    expect(reminderIdentifier('isha')).toBe('jibon-prayer-isha');
  });

  it('cancels previous schedules before scheduling (idempotent reschedule)', async () => {
    const scheduler = makeScheduler();
    await scheduleDailyPrayerReminders([...ENTRIES], scheduler);
    await scheduleDailyPrayerReminders([...ENTRIES], scheduler);

    expect(
      scheduler.cancelled.filter((id) => id === 'jibon-prayer-fajr'),
    ).toHaveLength(2);
    expect(scheduler.scheduled).toHaveLength(10);
  });

  it('skips invalid times without blocking the others', async () => {
    const scheduler = makeScheduler();
    await scheduleDailyPrayerReminders(
      [
        { prayer: 'fajr', time: 'nope', texts: { title: 'Fajr', body: '' } },
        { prayer: 'dhuhr', time: '12:00', texts: { title: 'Dhuhr', body: '' } },
      ],
      scheduler,
    );

    expect(scheduler.scheduled.map((call) => call.identifier)).toEqual(['jibon-prayer-dhuhr']);
  });

  it('cancels exactly the five prayer schedules', async () => {
    const scheduler = makeScheduler();
    await cancelPrayerReminders(scheduler);

    expect(scheduler.cancelled).toEqual([
      'jibon-prayer-fajr',
      'jibon-prayer-dhuhr',
      'jibon-prayer-asr',
      'jibon-prayer-maghrib',
      'jibon-prayer-isha',
    ]);
  });

  it('enables after permission and reports denial', async () => {
    const scheduler = makeScheduler();
    expect(await enablePrayerReminders([...ENTRIES], scheduler)).toEqual({ ok: true });
    expect(scheduler.scheduled).toHaveLength(5);

    const denied = makeScheduler({}, false);
    expect(await enablePrayerReminders([...ENTRIES], denied)).toEqual({
      ok: false,
      reason: 'denied',
    });
    expect(denied.scheduled).toHaveLength(0);
  });

  it('reports unavailable when the platform throws', async () => {
    const broken: ReminderScheduler = {
      getPermissionsAsync: async () => {
        throw new Error('no module');
      },
      requestPermissionsAsync: async () => ({ granted: false }),
      setNotificationChannelAsync: async () => undefined,
      setNotificationHandler: () => {},
      scheduleNotificationAsync: async () => 'x',
      cancelScheduledNotificationAsync: async () => {},
    };
    expect(await enablePrayerReminders([...ENTRIES], broken)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('configures HIGH importance channel and audible foreground presentation', async () => {
    const scheduler = makeScheduler();
    await scheduleDailyPrayerReminders([...ENTRIES], scheduler);

    expect(scheduler.channels).toEqual([
      {
        id: PRAYER_REMINDER_CHANNEL_ID,
        channel: { name: 'Prayer times', importance: 6 },
      },
    ]);
    const behavior = await scheduler.getHandlerBehavior();
    expect(behavior).toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });
});
