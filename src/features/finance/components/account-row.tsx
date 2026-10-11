import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { ACCOUNT_TYPE_ICONS } from '@/features/finance/meta';
import { useTranslation } from '@/i18n';
import { formatMoney } from '@/i18n/format';
import { Colors, IconSize, Spacing } from '@/theme/tokens';
import type { AccountWithBalance } from '@/types/finance';

export interface AccountRowProps {
  account: AccountWithBalance;
  onPress?: () => void;
  testID?: string;
}

/** One account with its derived balance and recorded activity count. */
export function AccountRow({ account, onPress, testID }: AccountRowProps) {
  const { t, locale } = useTranslation();
  const activityCount = account.transactionCount + account.transferCount;

  return (
    <Card onPress={onPress} testID={testID} accessibilityLabel={account.name}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name={ACCOUNT_TYPE_ICONS[account.type]} size={IconSize.md} color={Colors.primary} />
        </View>
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {account.name}
            </AppText>
            {account.isArchived ? (
              <Badge
                label={t('finance.accounts.archivedBadge')}
                color={Colors.textSecondary}
                backgroundColor={Colors.surfaceMuted}
              />
            ) : null}
          </View>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {`${t(`finance.accountTypes.${account.type}`)} · ${t('finance.accounts.activityCount', { count: activityCount })}`}
          </AppText>
        </View>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {formatMoney(account.balanceMinor, locale)}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    flexShrink: 1,
  },
});
