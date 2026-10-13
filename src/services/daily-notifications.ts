import { defaultScheduler, type ReminderScheduler } from './prayer-reminders';

export type { ReminderScheduler };

/**
 * Second-wave daily notifications over the OS scheduler: the morning tasks
 * digest and the 9 PM day recap. Same injectable-scheduler pattern as
 * `prayer-reminders`, so unit tests pass a fake and production uses the
 * `expo-notifications` adapter.
 *
 * Exactly two daily-repeating schedules ever exist here (one digest, one
 * recap), each replaced — never duplicated — on every reschedule. The
 * notification bodies carry counts computed at schedule time (each cold
 * start refreshes them); local scheduled notifications cannot compute fresh
 * content at fire time.
 */

export const DAILY_CHANNEL_ID = 'jibon-daily-v2';
export const DAILY_CHANNEL_NAME = 'Daily reminders';

/** Morning digest of pending tasks due today or overdue. */
export const TASK_DIGEST_IDENTIFIER = 'jibon-tasks-digest';
export const TASK_DIGEST_HOUR = 8;
export const TASK_DIGEST_MINUTE = 0;

/** Evening recap of the day's prayers and completed tasks. */
export const DAY_RECAP_IDENTIFIER = 'jibon-day-recap';
export const DAY_RECAP_HOUR = 21;
export const DAY_RECAP_MINUTE = 0;

export interface DailyNotificationTexts {
  title: string;
  body: string;
}

/** Whether the OS currently allows our notifications (no prompt shown). */
export async function getNotificationPermission(
  scheduler: ReminderScheduler = defaultScheduler(),
): Promise<boolean> {
  try {
    return (await scheduler.getPermissionsAsync()).granted === true;
  } catch {
    return false;
  }
}

/**
 * Schedules (replacing any previous schedule with the same identifier) one
 * daily notification at `hour:minute`. Throws when the platform cannot
 * schedule — callers decide whether that is fatal.
 */
export async function scheduleDailyNotification(
  identifier: string,
  texts: DailyNotificationTexts,
  hour: number,
  minute: number,
  url: string,
  scheduler: ReminderScheduler = defaultScheduler(),
): Promise<void> {
  try {
    await scheduler.setNotificationChannelAsync(DAILY_CHANNEL_ID, {
      name: DAILY_CHANNEL_NAME,
      importance: 6,
    });
  } catch {
    // Non-Android platforms have no channels; continue regardless.
  }
  try {
    scheduler.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Showing while foregrounded is a nicety, not a requirement.
  }
  try {
    await scheduler.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Nothing scheduled yet; continue.
  }
  await scheduler.scheduleNotificationAsync({
    identifier,
    content: {
      title: texts.title,
      body: texts.body,
      data: { url },
    },
    trigger: {
      type: 'daily',
      hour,
      minute,
      channelId: DAILY_CHANNEL_ID,
    },
  });
}

/** Cancels one daily schedule; never touches anything else. Never throws. */
export async function cancelDailyNotification(
  identifier: string,
  scheduler: ReminderScheduler = defaultScheduler(),
): Promise<void> {
  try {
    await scheduler.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Already gone or unschedulable; nothing to do.
  }
}
