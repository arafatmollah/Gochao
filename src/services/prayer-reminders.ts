import type { PrayerName, PrayerTime } from '@/types/prayer';
import { PRAYERS } from '@/types/prayer';

/**
 * Prayer-time reminders over the OS scheduler (master prompt Module J,
 * prayer slice).
 *
 * Exactly five daily-repeating schedules ever exist — one per prayer — so
 * scheduling stays bounded by construction (no per-day fan-out, no
 * unlimited notifications). Toggling off or recalculating cancels our five
 * identifiers first; other apps' or features' schedules are never touched.
 *
 * The scheduler is injectable so tests never touch native modules. All
 * failures collapse to `denied` (permission) or `unavailable` (anything
 * else, including unsupported platforms such as web).
 */

export const PRAYER_REMINDER_CHANNEL_ID = 'prayer-times-v2';
export const PRAYER_REMINDER_CHANNEL_NAME = 'Prayer times';

export function reminderIdentifier(prayer: PrayerName): string {
  return `jibon-prayer-${prayer}`;
}

export interface ReminderTexts {
  title: string;
  body: string;
}

/** Minimal surface of `expo-notifications` used here. */
export interface ReminderScheduler {
  getPermissionsAsync(): Promise<{ granted: boolean }>;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  setNotificationChannelAsync(id: string, channel: { name: string; importance: number }): Promise<unknown>;
  setNotificationHandler(handler: {
    handleNotification: () => Promise<Record<string, boolean>>;
  }): void;
  scheduleNotificationAsync(request: {
    identifier: string;
    content: { title: string; body: string; data: Record<string, string> };
    trigger: { type: 'daily'; hour: number; minute: number; channelId?: string };
  }): Promise<string>;
  cancelScheduledNotificationAsync(identifier: string): Promise<void>;
}

export type ReminderFailure = 'denied' | 'unavailable';
export type EnableRemindersResult = { ok: true } | { ok: false; reason: ReminderFailure };

export function defaultScheduler(): ReminderScheduler {
  // Lazy so the web bundle (no native module) never evaluates the import
  // unless a native code path actually schedules.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications');
  const grantedOf = (status: { granted?: boolean }): { granted: boolean } => ({
    granted: status.granted === true,
  });
  return {
    getPermissionsAsync: async () => grantedOf(await Notifications.getPermissionsAsync()),
    requestPermissionsAsync: async () => grantedOf(await Notifications.requestPermissionsAsync()),
    setNotificationChannelAsync: (id, channel) =>
      Notifications.setNotificationChannelAsync(id, {
        name: channel.name,
        // AndroidImportance.HIGH is 6 in expo-notifications
        importance: channel.importance ?? (Notifications.AndroidImportance?.HIGH ?? 6),
        sound: 'default',
        enableVibrate: true,
      }),
    setNotificationHandler: (handler) => Notifications.setNotificationHandler(handler),
    scheduleNotificationAsync: (request) =>
      Notifications.scheduleNotificationAsync({
        identifier: request.identifier,
        content: { ...request.content, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: request.trigger.hour,
          minute: request.trigger.minute,
          channelId: request.trigger.channelId,
        },
      }),
    cancelScheduledNotificationAsync: (identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier),
  };
}

function parseHourMinute(time: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    return null;
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/**
 * Schedules one daily notification per prayer time. Replaces any previous
 * prayer schedules first. Throws nothing — per-prayer failures are skipped
 * so one bad time never blocks the other four.
 */
export async function scheduleDailyPrayerReminders(
  entries: (PrayerTime & { texts: ReminderTexts })[],
  scheduler: ReminderScheduler = defaultScheduler(),
): Promise<void> {
  try {
    await scheduler.setNotificationChannelAsync(PRAYER_REMINDER_CHANNEL_ID, {
      name: PRAYER_REMINDER_CHANNEL_NAME,
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

  await cancelPrayerReminders(scheduler);
  for (const entry of entries) {
    const clock = parseHourMinute(entry.time);
    if (!clock) {
      continue;
    }
    try {
      await scheduler.scheduleNotificationAsync({
        identifier: reminderIdentifier(entry.prayer),
        content: {
          title: entry.texts.title,
          body: entry.texts.body,
          data: { url: '/prayer' },
        },
        trigger: {
          type: 'daily',
          hour: clock.hour,
          minute: clock.minute,
          channelId: PRAYER_REMINDER_CHANNEL_ID,
        },
      });
    } catch {
      continue;
    }
  }
}

/** Cancels our five prayer schedules; never touches anything else. */
export async function cancelPrayerReminders(
  scheduler: ReminderScheduler = defaultScheduler(),
): Promise<void> {
  for (const prayer of PRAYERS) {
    try {
      await scheduler.cancelScheduledNotificationAsync(reminderIdentifier(prayer));
    } catch {
      continue;
    }
  }
}

/**
 * Requests permission when needed, then schedules. Returns `denied` when
 * the user refuses (or the prompt cannot be shown) and `unavailable` when
 * the platform cannot schedule at all.
 */
export async function enablePrayerReminders(
  entries: (PrayerTime & { texts: ReminderTexts })[],
  scheduler: ReminderScheduler = defaultScheduler(),
): Promise<EnableRemindersResult> {
  try {
    const current = await scheduler.getPermissionsAsync();
    if (!current.granted) {
      const asked = await scheduler.requestPermissionsAsync();
      if (!asked.granted) {
        return { ok: false, reason: 'denied' };
      }
    }
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  try {
    await scheduleDailyPrayerReminders(entries, scheduler);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: true };
}
