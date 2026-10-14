import { daysUntil } from './entertainment-sync';

/**
 * Followed-premiere tracker: a data-driven list of dated episode drops with
 * 1-day-early (and day-of) alerts. Fully offline — no API key, no network —
 * so it works the moment the app opens. New drops are added by extending
 * `PREMIERES`; the TMDB sync covers everything else once a key is saved.
 */

export interface PremiereDrop {
  /** Stable id, e.g. `vision-quest-s1e1`. */
  id: string;
  show: string;
  season: number;
  episode: number;
  /** `YYYY-MM-DD` premiere date. */
  airDate: string;
}

export const PREMIERES: PremiereDrop[] = [
  { id: 'vision-quest-s1e1', show: 'Vision Quest', season: 1, episode: 1, airDate: '2026-10-14' },
  { id: 'vision-quest-s1e2', show: 'Vision Quest', season: 1, episode: 2, airDate: '2026-10-14' },
  { id: 'vision-quest-s1e3', show: 'Vision Quest', season: 1, episode: 3, airDate: '2026-10-21' },
  { id: 'vision-quest-s1e4', show: 'Vision Quest', season: 1, episode: 4, airDate: '2026-10-21' },
  { id: 'vision-quest-s1e5', show: 'Vision Quest', season: 1, episode: 5, airDate: '2026-10-28' },
  { id: 'vision-quest-s1e6', show: 'Vision Quest', season: 1, episode: 6, airDate: '2026-10-28' },
  { id: 'vision-quest-s1e7', show: 'Vision Quest', season: 1, episode: 7, airDate: '2026-11-04' },
  { id: 'vision-quest-s1e8', show: 'Vision Quest', season: 1, episode: 8, airDate: '2026-11-11' },
];

/** app_settings key holding the JSON array of already-alerted drop ids. */
export const ENT_PREMIERE_NOTIFIED = 'entertainment.premiereNotified';

export interface PremiereAlert {
  key: string;
  title: string;
  body: string;
}

export interface PremiereLabels {
  premiereTomorrow: (show: string, episode: string) => string;
  premiereToday: (show: string, episode: string) => string;
}

export function episodeLabel(drop: Pick<PremiereDrop, 'season' | 'episode'>): string {
  return `S${drop.season} E${drop.episode}`;
}

/**
 * Picks alerts for drops airing tomorrow (1-day-early) or today, soonest
 * first, skipping already-notified ids. Pure and fully unit-tested.
 */
export function pickPremiereAlerts(
  drops: PremiereDrop[],
  todayIso: string,
  notified: readonly string[],
  labels: PremiereLabels,
): PremiereAlert[] {
  const seen = new Set(notified);
  return drops
    .map((drop) => ({ drop, diff: daysUntil(todayIso, drop.airDate) }))
    .filter(({ diff }) => diff === 0 || diff === 1)
    .sort((a, b) => a.diff - b.diff || a.drop.episode - b.drop.episode)
    .filter(({ drop }) => !seen.has(drop.id))
    .slice(0, 5)
    .map(({ drop, diff }) => {
      const label = episodeLabel(drop);
      return {
        key: drop.id,
        title: drop.show,
        body:
          diff === 1
            ? labels.premiereTomorrow(drop.show, label)
            : labels.premiereToday(drop.show, label),
      };
    });
}
