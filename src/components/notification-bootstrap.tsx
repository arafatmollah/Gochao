import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { SqlitePrayerRepository } from '@/db/repositories/prayer-repository';
import { SqliteTaskRepository } from '@/db/repositories/task-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { formatWallClock12 } from '@/i18n/format';
import {
  DAY_RECAP_HOUR,
  DAY_RECAP_IDENTIFIER,
  DAY_RECAP_MINUTE,
  TASK_DIGEST_HOUR,
  TASK_DIGEST_IDENTIFIER,
  TASK_DIGEST_MINUTE,
  cancelDailyNotification,
  getNotificationPermission,
  scheduleDailyNotification,
} from '@/services/daily-notifications';
import {
  enablePrayerReminders,
  scheduleDailyPrayerReminders,
} from '@/services/prayer-reminders';
import { createPrayerService } from '@/services/prayer-service';
import { createTaskService } from '@/services/task-service';
import { localDayBoundsIso, todayIsoDate } from '@/utils/dates';

/**
 * Reconciles OS notification schedules on every cold start (native only;
 * `expo-notifications` has no web implementation). Rendered inside
 * `SQLiteProvider`, so the database is open when this runs.
 *
 * - Prayer times: five daily alarms at each start time. Auto-enables on a
 *   fresh install (permission undetermined) so notifications work without a
 *   settings detour; a deliberately-granted-then-disabled toggle is
 *   respected and left off.
 * - Morning digest (8 AM): pending tasks due today or overdue, with counts
 *   as of this app open. Cancelled when nothing is due instead of pinging
 *   an empty inbox.
 * - Day recap (9 PM): prayers prayed and tasks completed, with counts as of
 *   this app open.
 *
 * Every step is best-effort: notification failures never break app start.
 */
export function NotificationBootstrap() {
  const db = useSQLiteContext();
  const { t, locale } = useTranslation();
  const prayerService = useMemo(
    () => createPrayerService(new SqlitePrayerRepository(toSqlDatabase(db))),
    [db],
  );
  const taskService = useMemo(
    () => createTaskService(new SqliteTaskRepository(toSqlDatabase(db))),
    [db],
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const today = todayIsoDate();
        const [settings, day] = await Promise.all([
          prayerService.getSettings(),
          prayerService.getDay(today),
        ]);
        if (cancelled) {
          return;
        }

        const entries = day.prayers.map((entry) => ({
          prayer: entry.prayer,
          time: entry.time,
          texts: {
            title: t(`prayer.names.${entry.prayer}`),
            body: t('prayer.reminderBody', { time: formatWallClock12(entry.time, locale) }),
          },
        }));

        if (settings.remindersEnabled) {
          // Re-align daily prayer times with today's calculated times
          // so prayer alarms don't drift across days or seasons.
          await scheduleDailyPrayerReminders(entries);
        } else {
          // Fresh install (permission not granted yet): prompt once and turn
          // the five prayer alarms on. Already-granted-but-off means the
          // user disabled them deliberately — respect that.
          if (!(await getNotificationPermission())) {
            const enabled = await enablePrayerReminders(entries);
            if (!cancelled && enabled.ok) {
              await prayerService.updateSettings({ remindersEnabled: true });
            }
          }
        }

        try {
          const pending = await taskService.list({ status: 'pending', dueOnOrBefore: today });
          const dueToday = pending.filter((task) => task.dueAt === today).length;
          const overdue = pending.filter(
            (task) => task.dueAt !== null && task.dueAt < today,
          ).length;
          if (cancelled) {
            return;
          }
          if (dueToday + overdue > 0) {
            const parts: string[] = [];
            if (dueToday > 0) {
              parts.push(t('notifications.tasksDueToday', { count: dueToday }));
            }
            if (overdue > 0) {
              parts.push(t('notifications.tasksOverdue', { count: overdue }));
            }
            await scheduleDailyNotification(
              TASK_DIGEST_IDENTIFIER,
              { title: t('notifications.tasksDigestTitle'), body: parts.join(' · ') },
              TASK_DIGEST_HOUR,
              TASK_DIGEST_MINUTE,
              '/tasks',
            );
          } else {
            await cancelDailyNotification(TASK_DIGEST_IDENTIFIER);
          }
        } catch {
          // Digest is best-effort; prayer alarms and recap are independent.
        }

        try {
          const prayed = day.prayers.filter((entry) => entry.status === 'prayed').length;
          const { startIso, endIso } = localDayBoundsIso();
          const tasksDone = await taskService.countCompletedBetween(startIso, endIso);
          if (cancelled) {
            return;
          }
          await scheduleDailyNotification(
            DAY_RECAP_IDENTIFIER,
            {
              title: t('notifications.recapTitle'),
              body: t('notifications.recapBody', {
                prayed,
                prayers: day.prayers.length,
                tasks: tasksDone,
              }),
            },
            DAY_RECAP_HOUR,
            DAY_RECAP_MINUTE,
            '/',
          );
        } catch {
          // Recap is best-effort.
        }
      } catch {
        // Notifications must never break app start.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, t, locale, prayerService, taskService]);

  return null;
}
