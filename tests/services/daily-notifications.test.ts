import {
  cancelDailyNotification,
  DAY_RECAP_HOUR,
  DAY_RECAP_IDENTIFIER,
  DAY_RECAP_MINUTE,
  DAILY_CHANNEL_ID,
  scheduleDailyNotification,
  TASK_DIGEST_HOUR,
  TASK_DIGEST_IDENTIFIER,
  TASK_DIGEST_MINUTE,
  type ReminderScheduler,
} from '@/services/daily-notifications';

interface ScheduledCall {
  identifier: string;
  title: string;
  body: string;
  url: string;
  hour: number;
  minute: number;
  channelId?: string;
}

function makeScheduler(
  overrides: Partial<ReminderScheduler> = {},
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
  };
  return {
    scheduled: state.scheduled,
    cancelled: state.cancelled,
    channels: state.channels,
    getHandlerBehavior: async () => registeredHandler?.handleNotification(),
    getPermissionsAsync: async () => ({ granted: true }),
    requestPermissionsAsync: async () => ({ granted: true }),
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
        body: request.content.body,
        url: request.content.data.url,
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

describe('daily notifications', () => {
  it('schedules the tasks digest daily at 8 AM with a tasks deep link', async () => {
    const scheduler = makeScheduler();
    await scheduleDailyNotification(
      TASK_DIGEST_IDENTIFIER,
      { title: "Today's tasks", body: '3 due today · 1 overdue' },
      TASK_DIGEST_HOUR,
      TASK_DIGEST_MINUTE,
      '/tasks',
      scheduler,
    );

    expect(TASK_DIGEST_HOUR).toBe(8);
    expect(TASK_DIGEST_MINUTE).toBe(0);
    expect(scheduler.scheduled).toHaveLength(1);
    expect(scheduler.scheduled[0]).toMatchObject({
      identifier: 'jibon-tasks-digest',
      title: "Today's tasks",
      body: '3 due today · 1 overdue',
      url: '/tasks',
      hour: 8,
      minute: 0,
      channelId: DAILY_CHANNEL_ID,
    });
    expect(scheduler.channels).toEqual([
      {
        id: DAILY_CHANNEL_ID,
        channel: { name: 'Daily reminders', importance: 6 },
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

  it('schedules the day recap daily at 9 PM with a home deep link', async () => {
    const scheduler = makeScheduler();
    await scheduleDailyNotification(
      DAY_RECAP_IDENTIFIER,
      { title: 'Day recap', body: 'Today: 3 of 5 prayers, 2 tasks done' },
      DAY_RECAP_HOUR,
      DAY_RECAP_MINUTE,
      '/',
      scheduler,
    );

    expect(DAY_RECAP_HOUR).toBe(21);
    expect(DAY_RECAP_MINUTE).toBe(0);
    expect(scheduler.scheduled).toHaveLength(1);
    expect(scheduler.scheduled[0]).toMatchObject({
      identifier: 'jibon-day-recap',
      url: '/',
      hour: 21,
      minute: 0,
      channelId: DAILY_CHANNEL_ID,
    });
  });

  it('replaces the previous schedule instead of duplicating it', async () => {
    const scheduler = makeScheduler();
    await scheduleDailyNotification(
      TASK_DIGEST_IDENTIFIER,
      { title: 't', body: 'b' },
      TASK_DIGEST_HOUR,
      TASK_DIGEST_MINUTE,
      '/tasks',
      scheduler,
    );
    await scheduleDailyNotification(
      TASK_DIGEST_IDENTIFIER,
      { title: 't', body: 'b' },
      TASK_DIGEST_HOUR,
      TASK_DIGEST_MINUTE,
      '/tasks',
      scheduler,
    );

    expect(scheduler.cancelled).toEqual(['jibon-tasks-digest', 'jibon-tasks-digest']);
    expect(scheduler.scheduled).toHaveLength(2);
  });

  it('cancels a daily schedule without touching anything else', async () => {
    const scheduler = makeScheduler();
    await cancelDailyNotification(TASK_DIGEST_IDENTIFIER, scheduler);

    expect(scheduler.cancelled).toEqual(['jibon-tasks-digest']);
    expect(scheduler.scheduled).toHaveLength(0);
  });

  it('propagates scheduling failures so callers can fall back', async () => {
    const scheduler = makeScheduler({
      scheduleNotificationAsync: async () => {
        throw new Error('unavailable');
      },
    });

    await expect(
      scheduleDailyNotification(
        DAY_RECAP_IDENTIFIER,
        { title: 't', body: 'b' },
        DAY_RECAP_HOUR,
        DAY_RECAP_MINUTE,
        '/',
        scheduler,
      ),
    ).rejects.toThrow('unavailable');
  });
});
