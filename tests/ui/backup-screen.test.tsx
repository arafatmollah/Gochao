import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router');
jest.mock('@/features/backup/hooks/use-backup');

import BackupScreen from '@/app/backup';
import { useBackup } from '@/features/backup/hooks/use-backup';

const mockUseBackup = useBackup as jest.Mock;

function baseBackup(overrides: Record<string, unknown> = {}) {
  return {
    isConfigured: true,
    accountEmail: null,
    autoBackup: true,
    lastBackupAt: null,
    signingIn: false,
    backingUp: false,
    restoring: false,
    error: null,
    notice: null,
    clearNotice: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    backupNow: jest.fn(),
    restoreNow: jest.fn(),
    setAutoBackup: jest.fn(),
    ...overrides,
  };
}

describe('BackupScreen', () => {
  beforeEach(() => {
    mockUseBackup.mockReturnValue(baseBackup());
  });

  it('signs in and backs up from the buttons', async () => {
    const signIn = jest.fn();
    const backupNow = jest.fn();
    mockUseBackup.mockReturnValue(baseBackup({ signIn, backupNow }));
    await render(<BackupScreen />);

    await fireEvent.press(screen.getByTestId('backup-sign-in'));
    expect(signIn).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('backup-now'));
    expect(backupNow).toHaveBeenCalledTimes(1);
  });

  it('shows the account and last backup once signed in', async () => {
    mockUseBackup.mockReturnValue(
      baseBackup({ accountEmail: 'user@gmail.com', lastBackupAt: '2026-10-13T10:00:00.000Z' }),
    );
    await render(<BackupScreen />);

    expect(screen.getByText('user@gmail.com')).toBeTruthy();
    expect(screen.getByTestId('backup-sign-out')).toBeTruthy();
    expect(screen.getByTestId('backup-auto-toggle')).toBeTruthy();
  });

  it('asks twice before restoring', async () => {
    const restoreNow = jest.fn();
    mockUseBackup.mockReturnValue(baseBackup({ accountEmail: 'user@gmail.com', restoreNow }));
    await render(<BackupScreen />);

    // First tap only arms the confirm state.
    await fireEvent.press(screen.getByTestId('backup-restore'));
    expect(restoreNow).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('backup-restore'));
    expect(restoreNow).toHaveBeenCalledTimes(1);
  });

  it('displays an unconfigured banner when Google sign-in is not set up', async () => {
    mockUseBackup.mockReturnValue(baseBackup({ isConfigured: false }));
    await render(<BackupScreen />);

    expect(screen.getByTestId('backup-not-configured-banner')).toBeTruthy();
  });
});
