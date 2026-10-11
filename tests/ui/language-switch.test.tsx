import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: jest.fn(),
}));

import { useSQLiteContext } from 'expo-sqlite';
import {
  LANGUAGE_SETTING_KEY,
  SqliteSettingsRepository,
} from '@/db/repositories/settings-repository';
import { I18nProvider, useTranslation } from '@/i18n';

import { createMigratedDatabase, type TestDatabase } from '../helpers/node-sqlite-database';

function LocaleProbe() {
  const { locale, setLocale, t } = useTranslation();
  return (
    <View>
      <Text testID="probe-locale">{locale}</Text>
      <Text testID="probe-today">{t('dates.today')}</Text>
      <Pressable testID="probe-switch-bn" onPress={() => void setLocale('bn')}>
        <Text>switch</Text>
      </Pressable>
    </View>
  );
}

describe('language preference flow', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createMigratedDatabase();
    (useSQLiteContext as jest.Mock).mockReturnValue(db);
  });

  afterEach(() => {
    db.close();
  });

  it('starts in English, switches to Bangla, and persists across a reload', async () => {
    const first = await render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );

    await screen.findByText('en');
    expect(screen.getByText('Today')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('probe-switch-bn'));

    await screen.findByText('bn');
    expect(screen.getByText('আজ')).toBeTruthy();

    await waitFor(async () => {
      const stored = await new SqliteSettingsRepository(db).get(LANGUAGE_SETTING_KEY);
      expect(stored).toBe('bn');
    });

    await first.unmount();
    await render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );

    await screen.findByText('bn');
    expect(screen.getByText('আজ')).toBeTruthy();
  });

  it('applies a stored Bangla preference on startup and reports ready', async () => {
    await new SqliteSettingsRepository(db).set(LANGUAGE_SETTING_KEY, 'bn');
    const onReady = jest.fn();

    await render(
      <I18nProvider onReady={onReady}>
        <LocaleProbe />
      </I18nProvider>,
    );

    await screen.findByText('bn');
    expect(screen.getByText('আজ')).toBeTruthy();
    await waitFor(() => expect(onReady).toHaveBeenCalled());
  });

  it('ignores an unknown stored value and still reports ready', async () => {
    await new SqliteSettingsRepository(db).set(LANGUAGE_SETTING_KEY, 'fr');
    const onReady = jest.fn();

    await render(
      <I18nProvider onReady={onReady}>
        <LocaleProbe />
      </I18nProvider>,
    );

    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(screen.getByText('en')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('still becomes ready when reading the preference fails', async () => {
    jest.spyOn(db, 'getFirstAsync').mockRejectedValueOnce(new Error('unreadable'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const onReady = jest.fn();

    await render(
      <I18nProvider onReady={onReady}>
        <LocaleProbe />
      </I18nProvider>,
    );

    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(screen.getByText('en')).toBeTruthy();
    warn.mockRestore();
  });
});
