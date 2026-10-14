import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { SqliteWatchlistRepository } from '@/db/repositories/entertainment-repository';
import { SqliteEntertainmentIntelligenceRepository } from '@/db/repositories/entertainment-intelligence-repository';
import { SqliteSettingsRepository } from '@/db/repositories/settings-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { sendImmediateNotification } from '@/services/daily-notifications';
import { createEntertainmentService } from '@/services/entertainment-service';
import { syncIfDue } from '@/services/entertainment-sync';
import {
  ENT_PREMIERE_NOTIFIED,
  PREMIERES,
  pickPremiereAlerts,
} from '@/services/premiere-tracker';
import { todayIsoDate } from '@/utils/dates';

/**
 * Silent recommendations sync on every cold start (native only): when a
 * TMDB key is saved, the device is online, and the last sync is older than
 * 12 hours, fresh picks land in the watchlist and release alerts notify.
 * Followed-premiere alerts (currently Vision Quest S1) need no key and run
 * every start. Best-effort and invisible — failures only surface on the
 * Entertainment screen's manual check.
 */
export function EntertainmentBootstrap() {
  const db = useSQLiteContext();
  const { t } = useTranslation();

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    void (async () => {
      try {
        const sql = toSqlDatabase(db);
        const settings = new SqliteSettingsRepository(sql);
        // Followed premieres first: offline, keyless, always fresh.
        try {
          const stored = await settings.get(ENT_PREMIERE_NOTIFIED);
          let notified: string[] = [];
          try {
            const parsed: unknown = stored ? JSON.parse(stored) : [];
            if (Array.isArray(parsed)) {
              notified = parsed.filter((key): key is string => typeof key === 'string');
            }
          } catch {
            notified = [];
          }
          const alerts = pickPremiereAlerts(PREMIERES, todayIsoDate(), notified, {
            premiereTomorrow: (show, episode) =>
              t('entertainment.premiereTomorrow', { show, episode }),
            premiereToday: (show, episode) =>
              t('entertainment.premiereToday', { show, episode }),
          });
          for (const alert of alerts) {
            await sendImmediateNotification(alert.title, alert.body, '/entertainment');
            notified.push(alert.key);
          }
          if (alerts.length > 0) {
            await settings.set(ENT_PREMIERE_NOTIFIED, JSON.stringify(notified.slice(-120)));
          }
        } catch {
          // Premiere alerts are best-effort; the TMDB sync is independent.
        }
        await syncIfDue({
          service: createEntertainmentService(new SqliteWatchlistRepository(sql)),
          settings,
          intelRepo: new SqliteEntertainmentIntelligenceRepository(sql),
          t,
          todayIso: todayIsoDate(),
          trendingLabel: t('entertainment.sync.trendingLabel'),
          providerLabels: {
            netflix: t('entertainment.sync.providerNetflix'),
            max: t('entertainment.sync.providerMax'),
            prime: t('entertainment.sync.providerPrime'),
          },
          notify: (title, body) => sendImmediateNotification(title, body, '/entertainment'),
        });
      } catch {
        // Silent by design.
      }
    })();
  }, [db, t]);

  return null;
}
