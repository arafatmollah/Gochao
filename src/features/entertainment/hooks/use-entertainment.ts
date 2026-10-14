import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';

import { SqliteWatchlistRepository } from '@/db/repositories/entertainment-repository';
import {
  SqliteEntertainmentIntelligenceRepository,
  type CachedEpisodeItem,
  type CachedMediaItem,
} from '@/db/repositories/entertainment-intelligence-repository';
import { SqliteSettingsRepository } from '@/db/repositories/settings-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { SPOTLIGHT_ACCLAIMED, SPOTLIGHT_UPCOMING } from '@/features/entertainment/catalog';
import type { IntelligenceItem } from '@/features/entertainment/components/intelligence-card';
import { useTranslation } from '@/i18n';
import { formatIsoDateDisplay } from '@/i18n/format';
import { translateError } from '@/i18n/errors';
import { createEntertainmentService } from '@/services/entertainment-service';
import { sendImmediateNotification } from '@/services/daily-notifications';
import {
  ENT_API_KEY,
  ENT_FEED,
  ENT_LAST_SYNC,
  readFeed,
  syncIfDue,
  type FeedEntry,
} from '@/services/entertainment-sync';
import { PREMIERES } from '@/services/premiere-tracker';
import type {
  SpotlightEntry,
  WatchItem,
  WatchKind,
  WatchStatus,
} from '@/types/entertainment';
import { todayIsoDate } from '@/utils/dates';

import { useDebouncedValue } from '@/hooks/use-debounced-value';

export type EntertainmentSegment =
  | 'upcoming'
  | 'marvel'
  | 'for_you'
  | 'episodes'
  | 'library'
  | 'watchlist'
  | 'discover';

export type WatchStatusFilter = WatchStatus | 'all';

export interface SpotlightWithSaved extends SpotlightEntry {
  saved: boolean;
}

export interface UseEntertainmentResult {
  segment: EntertainmentSegment;
  setSegment: (segment: EntertainmentSegment) => void;

  items: WatchItem[];
  upcomingList: IntelligenceItem[];
  marvelList: IntelligenceItem[];
  forYouList: IntelligenceItem[];
  episodesList: IntelligenceItem[];

  forYouProvider: 'all' | 'netflix' | 'prime' | 'max';
  setForYouProvider: (provider: 'all' | 'netflix' | 'prime' | 'max') => void;

  upcoming: SpotlightWithSaved[];
  acclaimed: SpotlightWithSaved[];
  marvelFeed: SpotlightWithSaved[];
  trendingFeed: SpotlightWithSaved[];
  premiereFeed: SpotlightWithSaved[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  notice: string | null;
  clearNotice: () => void;

  search: string;
  setSearch: (search: string) => void;
  statusFilter: WatchStatusFilter;
  setStatusFilter: (filter: WatchStatusFilter) => void;
  kindFilter: WatchKind | null;
  setKindFilter: (kind: WatchKind | null) => void;

  refresh: () => void;
  saveSpotlight: (entry: SpotlightEntry | IntelligenceItem) => Promise<void>;
  setStatus: (item: WatchItem, status: WatchStatus) => Promise<void>;
  removeItem: (item: WatchItem) => Promise<void>;
  openLink: (url: string) => Promise<void>;

  apiKey: string | null;
  apiKeyInput: string;
  setApiKeyInput: (value: string) => void;
  savingKey: boolean;
  saveApiKey: () => Promise<void>;
  lastSyncAt: string | null;
  syncing: boolean;
  syncError: string | null;
  syncNow: () => Promise<void>;
}

export function useEntertainment(): UseEntertainmentResult {
  const db = useSQLiteContext();
  const sql = useMemo(() => toSqlDatabase(db), [db]);
  const service = useMemo(() => createEntertainmentService(new SqliteWatchlistRepository(sql)), [sql]);
  const settings = useMemo(() => new SqliteSettingsRepository(sql), [sql]);
  const intelRepo = useMemo(() => new SqliteEntertainmentIntelligenceRepository(sql), [sql]);
  const { t } = useTranslation();

  const [segment, setSegment] = useState<EntertainmentSegment>('watchlist');
  const [forYouProvider, setForYouProvider] = useState<'all' | 'netflix' | 'prime' | 'max'>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [statusFilter, setStatusFilter] = useState<WatchStatusFilter>('all');
  const [kindFilter, setKindFilter] = useState<WatchKind | null>(null);

  const [items, setItems] = useState<WatchItem[]>([]);
  const [cachedUpcoming, setCachedUpcoming] = useState<CachedMediaItem[]>([]);
  const [cachedMarvel, setCachedMarvel] = useState<CachedMediaItem[]>([]);
  const [cachedForYou, setCachedForYou] = useState<CachedMediaItem[]>([]);
  const [cachedEpisodes, setCachedEpisodes] = useState<CachedEpisodeItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [feed, setFeed] = useState<{ marvel: FeedEntry[]; trending: FeedEntry[] }>({
    marvel: [],
    trending: [],
  });
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadOfflineIntel = useCallback(async () => {
    try {
      const today = todayIsoDate();
      const [upcoming, marvel, forYou, episodes] = await Promise.all([
        intelRepo.getUpcomingReleases(today, 30),
        intelRepo.getMarvelSlate(30),
        intelRepo.getMediaByCategory('for_you', 30),
        intelRepo.getUpcomingEpisodes(today, 30),
      ]);
      setCachedUpcoming(upcoming);
      setCachedMarvel(marvel);
      setCachedForYou(forYou);
      setCachedEpisodes(episodes);
    } catch {
      // Offline fallback defaults stand
    }
  }, [intelRepo]);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const listed = await service.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        kind: kindFilter ?? undefined,
        search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      });
      if (requestIdRef.current !== requestId) return;
      setItems(listed);
      setError(null);
    } catch (loadError) {
      if (requestIdRef.current !== requestId) return;
      setError(translateError(loadError, t));
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [service, statusFilter, kindFilter, debouncedSearch, t]);

  const refreshFeed = useCallback(async () => {
    try {
      const [storedKey, storedFeed, storedSync] = await Promise.all([
        settings.get(ENT_API_KEY),
        settings.get(ENT_FEED),
        settings.get(ENT_LAST_SYNC),
      ]);
      const activeKey = storedKey && storedKey.trim() !== '' ? storedKey : process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim() || null;
      setApiKey(activeKey);
      setApiKeyInput((current) => (current === '' && activeKey ? activeKey : current));
      setFeed(readFeed(storedFeed));
      setLastSyncAt(storedSync);
    } catch {
      // Feed is a nicety; catalog still renders
    }
  }, [settings]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await Promise.all([load(), loadOfflineIntel(), refreshFeed()]);
      })();
    }, [load, loadOfflineIntel, refreshFeed]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([load(), loadOfflineIntel(), refreshFeed()]);
  }, [load, loadOfflineIntel, refreshFeed]);

  const savedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of items) {
      keys.add(`${item.kind}::${item.title.trim().toLowerCase()}`);
    }
    return keys;
  }, [items]);

  const markSaved = useCallback(
    (entries: readonly SpotlightEntry[]): SpotlightWithSaved[] =>
      entries.map((entry) => ({
        ...entry,
        saved: savedKeys.has(`${entry.kind}::${entry.title.trim().toLowerCase()}`),
      })),
    [savedKeys],
  );

  const saveSpotlight = useCallback(
    async (entry: SpotlightEntry | IntelligenceItem) => {
      try {
        const title = entry.title;
        const kind = entry.kind;
        const notes =
          'blurb' in entry
            ? (entry as SpotlightEntry).blurb
            : (entry as IntelligenceItem).matchReason ?? undefined;
        await service.saveSpotlight(title, kind, { source: 'tmdb', notes: notes ?? undefined });
        await load();
        setNotice(t('entertainment.savedToList'));
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  const setStatus = useCallback(
    async (item: WatchItem, status: WatchStatus) => {
      try {
        await service.setStatus(item.id, status);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  const removeItem = useCallback(
    async (item: WatchItem) => {
      try {
        await service.remove(item.id);
        await load();
      } catch (actionError) {
        setNotice(translateError(actionError, t));
      }
    },
    [service, load, t],
  );

  const openLink = useCallback(async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setNotice(t('errors.generic'));
    }
  }, [t]);

  const saveApiKey = useCallback(async () => {
    const trimmed = apiKeyInput.trim();
    if (trimmed === '') {
      setSyncError(t('entertainment.sync.keyRequired'));
      return;
    }
    setSavingKey(true);
    try {
      await settings.set(ENT_API_KEY, trimmed);
      setApiKey(trimmed);
      setSyncError(null);
      setNotice(t('entertainment.sync.keySaved'));
    } catch (saveError) {
      setSyncError(translateError(saveError, t));
    } finally {
      setSavingKey(false);
    }
  }, [apiKeyInput, settings, t]);

  const syncNow = useCallback(async () => {
    if (syncing) {
      return;
    }
    setSyncing(true);
    setSyncError(null);
    try {
      const summary = await syncIfDue({
        service,
        settings,
        intelRepo,
        t,
        todayIso: todayIsoDate(),
        trendingLabel: t('entertainment.sync.trendingLabel'),
        providerLabels: {
          netflix: t('entertainment.sync.providerNetflix'),
          max: t('entertainment.sync.providerMax'),
          prime: t('entertainment.sync.providerPrime'),
        },
        notify: (title, body) => sendImmediateNotification(title, body, '/entertainment'),
        force: true,
      });
      await Promise.all([refreshFeed(), load(), loadOfflineIntel()]);
      if (summary.error === 'auth') {
        setSyncError(t('entertainment.sync.invalidKey'));
      } else if (summary.error) {
        setSyncError(t('entertainment.sync.syncFailed'));
      } else if (summary.added > 0) {
        setNotice(t('entertainment.sync.addedCount', { count: summary.added }));
      }
    } catch (syncErr) {
      setSyncError(translateError(syncErr, t));
    } finally {
      setSyncing(false);
    }
  }, [syncing, service, settings, intelRepo, t, refreshFeed, load, loadOfflineIntel]);

  // Transform cached SQLite media to IntelligenceItem list
  const upcomingList = useMemo<IntelligenceItem[]>(() => {
    if (cachedUpcoming.length > 0) {
      return cachedUpcoming.map((item) => ({
        id: item.id,
        tmdbId: item.tmdbId,
        title: item.title,
        kind: (item.mediaType === 'tv' ? 'series' : 'movie') as 'movie' | 'series',
        overview: item.overview,
        releaseDate: item.releaseDate,
        voteAverage: item.voteAverage,
        providers: item.providers,
        watchRegion: item.watchRegion,
        isMarvel: item.isMarvel,
        saved: savedKeys.has(`${item.mediaType === 'tv' ? 'series' : 'movie'}::${item.title.trim().toLowerCase()}`),
      }));
    }
    // Static offline catalog fallback
    return SPOTLIGHT_UPCOMING.map((spot) => ({
      id: spot.id,
      title: spot.title,
      kind: spot.kind,
      overview: spot.blurb,
      releaseDate: `${spot.year}-12-31`,
      saved: savedKeys.has(`${spot.kind}::${spot.title.trim().toLowerCase()}`),
    }));
  }, [cachedUpcoming, savedKeys]);

  const marvelList = useMemo<IntelligenceItem[]>(() => {
    if (cachedMarvel.length > 0) {
      return cachedMarvel.map((item) => ({
        id: item.id,
        tmdbId: item.tmdbId,
        title: item.title,
        kind: (item.mediaType === 'tv' ? 'series' : 'movie') as 'movie' | 'series',
        overview: item.overview,
        releaseDate: item.releaseDate,
        voteAverage: item.voteAverage,
        providers: item.providers,
        watchRegion: item.watchRegion,
        isMarvel: true,
        phase: item.phase || 'Multiverse Saga',
        saved: savedKeys.has(`${item.mediaType === 'tv' ? 'series' : 'movie'}::${item.title.trim().toLowerCase()}`),
      }));
    }
    // Curated fallback
    return [
      { id: 'm-avengers-doomsday', title: 'Avengers: Doomsday', kind: 'movie', releaseDate: '2026-12-18', isMarvel: true, phase: 'Phase 6', saved: savedKeys.has('movie::avengers: doomsday') },
      { id: 'm-spidey-4', title: 'Spider-Man 4', kind: 'movie', releaseDate: '2026-07-24', isMarvel: true, phase: 'Phase 6', saved: savedKeys.has('movie::spider-man 4') },
      { id: 'm-vision-quest', title: 'Vision Quest', kind: 'series', releaseDate: '2026-10-14', isMarvel: true, phase: 'Phase 6', saved: savedKeys.has('series::vision quest') },
    ];
  }, [cachedMarvel, savedKeys]);

  const forYouList = useMemo<IntelligenceItem[]>(() => {
    const list = cachedForYou.map((item) => ({
      id: item.id,
      tmdbId: item.tmdbId,
      title: item.title,
      kind: (item.mediaType === 'tv' ? 'series' : 'movie') as 'movie' | 'series',
      overview: item.overview,
      releaseDate: item.releaseDate,
      voteAverage: item.voteAverage,
      providers: item.providers,
      watchRegion: item.watchRegion,
      matchReason: item.overview ? `${item.genres.slice(0, 2).join(', ')}` : undefined,
      saved: savedKeys.has(`${item.mediaType === 'tv' ? 'series' : 'movie'}::${item.title.trim().toLowerCase()}`),
    }));

    if (forYouProvider === 'all') return list;
    return list.filter((i) => i.providers?.includes(forYouProvider));
  }, [cachedForYou, forYouProvider, savedKeys]);

  const episodesList = useMemo<IntelligenceItem[]>(() => {
    const dbEpisodes: IntelligenceItem[] = cachedEpisodes.map((ep) => ({
      id: ep.id,
      title: ep.showTitle,
      kind: 'series',
      episodeLabel: `S${ep.seasonNumber} E${ep.episodeNumber} · ${ep.name}`,
      releaseDate: ep.airDate,
      overview: ep.overview ?? undefined,
      isMarvel: ep.isMarvel,
      saved: savedKeys.has(`series::${ep.showTitle.trim().toLowerCase()}`),
    }));

    // Merge offline premiere tracker drops
    const offlineDrops: IntelligenceItem[] = PREMIERES.map((drop) => ({
      id: `premiere-${drop.id}`,
      title: drop.show,
      kind: 'series',
      episodeLabel: `S${drop.season} E${drop.episode}`,
      releaseDate: drop.airDate,
      isMarvel: true,
      saved: savedKeys.has(`series::${drop.show.trim().toLowerCase()}`),
    }));

    const combined = [...dbEpisodes, ...offlineDrops];
    const unique = new Map<string, IntelligenceItem>();
    for (const item of combined) {
      const key = `${item.title}:${item.episodeLabel}`;
      if (!unique.has(key)) unique.set(key, item);
    }
    return Array.from(unique.values()).sort((a, b) => {
      const dateA = a.releaseDate ?? '';
      const dateB = b.releaseDate ?? '';
      return dateA.localeCompare(dateB);
    });
  }, [cachedEpisodes, savedKeys]);

  const toSpotlight = useCallback(
    (entries: readonly FeedEntry[]): SpotlightWithSaved[] =>
      entries.map((entry) => ({
        id: `tmdb-${entry.tmdbId}`,
        title: entry.title,
        kind: entry.kind,
        year: entry.date ? entry.date.slice(0, 4) : '',
        blurb: [entry.episode, entry.rating, entry.source].filter((part) => part !== '').join(' · '),
        section: 'upcoming' as const,
        saved: savedKeys.has(`${entry.kind}::${entry.title.trim().toLowerCase()}`),
      })),
    [savedKeys],
  );

  const premiereFeed = useMemo<SpotlightWithSaved[]>(
    () =>
      PREMIERES.map((drop) => ({
        id: `premiere-${drop.id}`,
        title: drop.show,
        kind: 'series' as const,
        year: drop.airDate.slice(0, 4),
        blurb: `S${drop.season} E${drop.episode} · ${formatIsoDateDisplay(drop.airDate, t)}`,
        section: 'upcoming' as const,
        saved: savedKeys.has(`series::${drop.show.trim().toLowerCase()}`),
      })),
    [savedKeys, t],
  );

  return {
    segment,
    setSegment,
    items,
    upcomingList,
    marvelList,
    forYouList,
    episodesList,
    forYouProvider,
    setForYouProvider,
    upcoming: markSaved(SPOTLIGHT_UPCOMING),
    acclaimed: markSaved(SPOTLIGHT_ACCLAIMED),
    marvelFeed: toSpotlight(feed.marvel),
    trendingFeed: toSpotlight(feed.trending),
    premiereFeed,
    loading,
    refreshing,
    error,
    notice,
    clearNotice: () => setNotice(null),
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    kindFilter,
    setKindFilter,
    refresh,
    saveSpotlight,
    setStatus,
    removeItem,
    openLink,
    apiKey,
    apiKeyInput,
    setApiKeyInput,
    savingKey,
    saveApiKey,
    lastSyncAt,
    syncing,
    syncError,
    syncNow,
  };
}
