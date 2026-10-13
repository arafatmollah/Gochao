import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { SqlitePrayerRepository } from '@/db/repositories/prayer-repository';
import { toSqlDatabase } from '@/db/sqlite-adapter';
import { useTranslation } from '@/i18n';
import { translateError } from '@/i18n/errors';
import { createPrayerService } from '@/services/prayer-service';
import {
  cancelPrayerReminders,
  enablePrayerReminders,
  scheduleDailyPrayerReminders,
} from '@/services/prayer-reminders';
import { formatWallClock12 } from '@/i18n/format';
import { detectDeviceLocation } from '@/services/device-location';
import {
  formatUtcOffsetInput,
  parseAdjustInput,
  parseCoordinateInput,
  parseUtcOffsetInput,
  validatePrayerCity,
  validatePrayerLatitude,
  validatePrayerLongitude,
  validateUtcOffsetMinutes,
} from '@/services/prayer-validation';
import type {
  PrayerCalculationMethod,
  PrayerMadhab,
  PrayerName,
} from '@/types/prayer';
import { PRAYERS, PRAYER_CITY_MAX_LENGTH } from '@/types/prayer';
import { todayIsoDate } from '@/utils/dates';

export interface UsePrayerSettingsResult {
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;

  method: PrayerCalculationMethod;
  setMethod: (method: PrayerCalculationMethod) => void;
  madhab: PrayerMadhab;
  setMadhab: (madhab: PrayerMadhab) => void;
  city: string;
  setCity: (value: string) => void;
  /** Validation code (see `prayer-validation`); translate before rendering. */
  cityError: string | null;
  latitudeText: string;
  setLatitudeText: (value: string) => void;
  latitudeError: string | null;
  longitudeText: string;
  setLongitudeText: (value: string) => void;
  longitudeError: string | null;
  utcOffsetText: string;
  setUtcOffsetText: (value: string) => void;
  utcOffsetError: string | null;
  adjustTexts: Record<PrayerName, string>;
  setAdjustText: (prayer: PrayerName, value: string) => void;
  adjustError: string | null;

  formError: string | null;
  saving: boolean;
  submit: () => Promise<boolean>;
  /** Whether OS reminders are currently enabled. */
  remindersEnabled: boolean;
  togglingReminders: boolean;
  /** Translated reminder failure, shown near the reminders section. */
  remindersError: string | null;
  toggleReminders: () => Promise<void>;
  /** Fires an immediate test notification so the user can verify delivery. */
  testingNotification: boolean;
  /** Translated confirmation after a test notification is scheduled. */
  testNotice: string | null;
  clearTestNotice: () => void;
  sendTestNotification: () => Promise<void>;
  /** Device GPS detection state for the "use my location" button. */
  locating: boolean;
  /** Translated locate failure, cleared on the next attempt or edit. */
  locateError: string | null;
  detectLocation: () => Promise<void>;
}

function formatCoordinate(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

export function usePrayerSettings(): UsePrayerSettingsResult {
  const db = useSQLiteContext();
  const service = useMemo(
    () => createPrayerService(new SqlitePrayerRepository(toSqlDatabase(db))),
    [db],
  );
  const { t, locale } = useTranslation();

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [method, setMethod] = useState<PrayerCalculationMethod>('karachi');
  const [madhab, setMadhab] = useState<PrayerMadhab>('hanafi');
  const [city, setCity] = useState('');
  const [latitudeText, setLatitudeText] = useState('');
  const [longitudeText, setLongitudeText] = useState('');
  const [utcOffsetText, setUtcOffsetText] = useState('+6');
  const [adjustTexts, setAdjustTexts] = useState<Record<PrayerName, string>>({
    fajr: '0',
    dhuhr: '0',
    asr: '0',
    maghrib: '0',
    isha: '0',
  });

  const [cityError, setCityError] = useState<string | null>(null);
  const [latitudeError, setLatitudeError] = useState<string | null>(null);
  const [longitudeError, setLongitudeError] = useState<string | null>(null);
  const [utcOffsetError, setUtcOffsetError] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [togglingReminders, setTogglingReminders] = useState(false);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [testingNotification, setTestingNotification] = useState(false);
  const [testNotice, setTestNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    service
      .getSettings()
      .then((settings) => {
        if (!active) return;
        setMethod(settings.calculationMethod);
        setMadhab(settings.madhab);
        setCity(settings.cityLabel);
        setLatitudeText(formatCoordinate(settings.latitude));
        setLongitudeText(formatCoordinate(settings.longitude));
        setUtcOffsetText(formatUtcOffsetInput(settings.utcOffsetMinutes));
        setAdjustTexts({
          fajr: String(settings.adjustments.fajr),
          dhuhr: String(settings.adjustments.dhuhr),
          asr: String(settings.adjustments.asr),
          maghrib: String(settings.adjustments.maghrib),
          isha: String(settings.adjustments.isha),
        });
        setRemindersEnabled(settings.remindersEnabled);
        setLoadError(null);
        setLoadState('ready');
      })
      .catch((loadFailure: unknown) => {
        if (!active) return;
        setLoadError(translateError(loadFailure, t));
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [service, reloadKey, t]);

  const setAdjustText = useCallback(
    (prayer: PrayerName, value: string) => {
      setAdjustTexts((current) => ({ ...current, [prayer]: value }));
      if (adjustError) setAdjustError(null);
    },
    [adjustError],
  );

  /** Builds translated per-prayer entries and replaces the OS schedules. */
  const rescheduleForToday = useCallback(async () => {
    const day = await service.getDay(todayIsoDate());
    await scheduleDailyPrayerReminders(
      day.prayers.map((entry) => ({
        prayer: entry.prayer,
        time: entry.time,
        texts: {
          title: t(`prayer.names.${entry.prayer}`),
          body: t('prayer.reminderBody', { time: formatWallClock12(entry.time, locale) }),
        },
      })),
    );
  }, [service, t, locale]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (saving) {
      return false;
    }
    setFormError(null);

    const cityValidation = validatePrayerCity(city);
    setCityError(cityValidation);

    const latitude = parseCoordinateInput(latitudeText);
    const latitudeValidation =
      latitude === null ? 'prayer_latitude_invalid' : validatePrayerLatitude(latitude);
    setLatitudeError(latitude === null ? latitudeValidation : null);

    const longitude = parseCoordinateInput(longitudeText);
    const longitudeValidation =
      longitude === null ? 'prayer_longitude_invalid' : validatePrayerLongitude(longitude);
    setLongitudeError(longitude === null ? longitudeValidation : null);

    const utcOffsetMinutes = parseUtcOffsetInput(utcOffsetText);
    const utcOffsetValidation =
      utcOffsetMinutes === null
        ? 'prayer_timezone_invalid'
        : validateUtcOffsetMinutes(utcOffsetMinutes);
    setUtcOffsetError(utcOffsetMinutes === null ? utcOffsetValidation : null);

    let adjustFailed: string | null = null;
    const adjustments: Record<PrayerName, number> = {
      fajr: 0,
      dhuhr: 0,
      asr: 0,
      maghrib: 0,
      isha: 0,
    };
    for (const prayer of PRAYERS) {
      const parsed = parseAdjustInput(adjustTexts[prayer]);
      if (parsed === null) {
        adjustFailed = 'prayer_adjust_invalid';
        break;
      }
      adjustments[prayer] = parsed;
    }
    setAdjustError(adjustFailed);

    const valid =
      cityValidation === null &&
      latitudeValidation === null &&
      longitudeValidation === null &&
      utcOffsetValidation === null &&
      adjustFailed === null &&
      latitude !== null &&
      longitude !== null &&
      utcOffsetMinutes !== null;
    if (!valid) {
      return false;
    }

    setSaving(true);
    try {
      await service.updateSettings({
        calculationMethod: method,
        madhab,
        latitude,
        longitude,
        cityLabel: city.trim() === '' ? undefined : city,
        utcOffsetMinutes,
        adjustments,
      });
      // Times may have changed: refresh the OS schedules so reminders keep
      // matching the saved configuration. A reschedule failure never fails
      // the save itself — it surfaces next to the reminders section.
      if (remindersEnabled) {
        try {
          await rescheduleForToday();
        } catch {
          setRemindersError(t('prayer.remindersUnavailable'));
        }
      }
      return true;
    } catch (submitError) {
      setFormError(translateError(submitError, t));
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, city, latitudeText, longitudeText, utcOffsetText, adjustTexts, method, madhab, service, t, remindersEnabled, rescheduleForToday]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoadState('loading');
    setReloadKey((key) => key + 1);
  }, []);

  const toggleReminders = useCallback(async () => {
    if (togglingReminders || saving || locating) {
      return;
    }
    setRemindersError(null);
    setTogglingReminders(true);
    try {
      if (remindersEnabled) {
        await cancelPrayerReminders();
        await service.updateSettings({ remindersEnabled: false });
        setRemindersEnabled(false);
        return;
      }
      const result = await enablePrayerReminders(
        (await service.getDay(todayIsoDate())).prayers.map((entry) => ({
          prayer: entry.prayer,
          time: entry.time,
          texts: {
            title: t(`prayer.names.${entry.prayer}`),
            body: t('prayer.reminderBody', { time: formatWallClock12(entry.time, locale) }),
          },
        })),
      );
      if (!result.ok) {
        setRemindersError(
          result.reason === 'denied'
            ? t('prayer.remindersDenied')
            : t('prayer.remindersUnavailable'),
        );
        return;
      }
      await service.updateSettings({ remindersEnabled: true });
      setRemindersEnabled(true);
    } catch (toggleError) {
      setRemindersError(translateError(toggleError, t));
    } finally {
      setTogglingReminders(false);
    }
  }, [togglingReminders, saving, locating, remindersEnabled, service, t, locale]);

  const sendTestNotification = useCallback(async () => {
    if (togglingReminders || saving || locating || testingNotification) {
      return;
    }
    setTestNotice(null);
    setRemindersError(null);
    setTestingNotification(true);
    try {
      if (Platform.OS === 'web') {
        setRemindersError(t('prayer.remindersUnavailable'));
        return;
      }
      // Lazy so the web bundle never evaluates the native module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications');
      const current = await Notifications.getPermissionsAsync();
      let granted = current?.granted === true;
      if (!granted) {
        const asked = await Notifications.requestPermissionsAsync();
        granted = asked?.granted === true;
      }
      if (!granted) {
        setRemindersError(t('prayer.remindersDenied'));
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('prayer.testTitle'),
          body: t('prayer.testBody'),
          data: { url: '/prayer' },
        },
        trigger: null,
      });
      setTestNotice(t('prayer.testSent'));
    } catch {
      setRemindersError(t('prayer.remindersUnavailable'));
    } finally {
      setTestingNotification(false);
    }
  }, [togglingReminders, saving, locating, testingNotification, t]);

  const detectLocation = useCallback(async () => {
    if (locating || saving) {
      return;
    }
    setLocateError(null);
    setLocating(true);
    try {
      const result = await detectDeviceLocation();
      if (!result.ok) {
        setLocateError(
          result.reason === 'denied' ? t('prayer.locationDenied') : t('prayer.locationUnavailable'),
        );
        return;
      }
      setLatitudeText(formatCoordinate(result.location.latitude));
      setLongitudeText(formatCoordinate(result.location.longitude));
      if (result.location.cityLabel) {
        setCity(result.location.cityLabel);
        if (cityError) setCityError(null);
      }
      if (latitudeError) setLatitudeError(null);
      if (longitudeError) setLongitudeError(null);
    } finally {
      setLocating(false);
    }
  }, [locating, saving, t, cityError, latitudeError, longitudeError]);

  return {
    loadState,
    loadError,
    retryLoad,
    method,
    setMethod,
    madhab,
    setMadhab,
    city,
    setCity: (value) => {
      setCity(value);
      if (cityError) setCityError(null);
    },
    cityError,
    latitudeText,
    setLatitudeText: (value) => {
      setLatitudeText(value);
      if (latitudeError) setLatitudeError(null);
    },
    latitudeError,
    longitudeText,
    setLongitudeText: (value) => {
      setLongitudeText(value);
      if (longitudeError) setLongitudeError(null);
    },
    longitudeError,
    utcOffsetText,
    setUtcOffsetText: (value) => {
      setUtcOffsetText(value);
      if (utcOffsetError) setUtcOffsetError(null);
    },
    utcOffsetError,
    adjustTexts,
    setAdjustText,
    adjustError,
    formError,
    saving,
    submit,
    remindersEnabled,
    togglingReminders,
    remindersError,
    toggleReminders,
    testingNotification,
    testNotice,
    clearTestNotice: () => setTestNotice(null),
    sendTestNotification,
    locating,
    locateError,
    detectLocation,
  };
}

export { PRAYER_CITY_MAX_LENGTH };
