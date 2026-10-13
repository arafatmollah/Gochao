import { router, Stack } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { AccountRow } from '@/features/finance/components/account-row';
import { useAccounts } from '@/features/finance/hooks/use-accounts';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { AccountWithBalance } from '@/types/finance';

export default function FinanceAccountsScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { accounts, includeArchived, setIncludeArchived, loading, refreshing, error, refresh } =
    useAccounts();

  function openAccount(account: AccountWithBalance) {
    router.push({ pathname: '/account-form', params: { id: account.id } });
  }

  function openNewAccount() {
    router.push('/account-form');
  }

  return (
    <>
      <Stack.Screen options={{ title: t('finance.accounts.title') }} />
      <Screen edges={['bottom']}>
        <View style={styles.toolbar}>
          <Chip
            label={includeArchived ? t('finance.accounts.hideArchived') : t('finance.accounts.showArchived')}
            selected={includeArchived}
            onPress={() => setIncludeArchived(!includeArchived)}
            testID="accounts-archived-toggle"
          />
        </View>

        {loading ? (
          <LoadingState label={t('finance.accounts.loading')} />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : (
          <FlatList
            data={accounts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AccountRow account={item} onPress={() => openAccount(item)} testID={`account-row-${item.id}`} />
            )}
            ItemSeparatorComponent={ListItemSeparator}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListHeaderComponent={
              accounts.length > 0 ? (
                <AppText variant="caption" color="textMuted" style={styles.note}>
                  {t('finance.accounts.totalsNote')}
                </AppText>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="wallet-outline"
                title={t('finance.accounts.emptyTitle')}
                message={t('finance.accounts.emptyMessage')}
                actionLabel={t('finance.accounts.addAccount')}
                onAction={openNewAccount}
              />
            }
          />
        )}

        <Fab
          onPress={openNewAccount}
          accessibilityLabel={t('finance.accounts.addAccountA11y')}
          testID="add-account-fab"
        />
      </Screen>
    </>
  );
}

function ListItemSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 96,
    flexGrow: 1,
  },
  note: {
    paddingBottom: Spacing.sm,
  },
  separator: {
    height: Spacing.sm,
  },
});
