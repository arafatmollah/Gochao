import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/theme-context';
import { IconSize, Spacing } from '@/theme/tokens';

export interface FinanceQuickActionsProps {
  onAddIncome: () => void;
  onAddExpense: () => void;
  onTransfer: () => void;
  onReports: () => void;
  testID?: string;
}

/** Quick actions for the Finance tab; every action opens a working screen. */
export function FinanceQuickActions({
  onAddIncome,
  onAddExpense,
  onTransfer,
  onReports,
  testID,
}: FinanceQuickActionsProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.row} testID={testID}>
      <QuickAction
        icon="arrow-down-circle-outline"
        label={t('finance.overview.addIncome')}
        color={colors.success}
        backgroundColor={colors.successSoft}
        onPress={onAddIncome}
        testID="finance-quick-add-income"
      />
      <QuickAction
        icon="arrow-up-circle-outline"
        label={t('finance.overview.addExpense')}
        color={colors.danger}
        backgroundColor={colors.dangerSoft}
        onPress={onAddExpense}
        testID="finance-quick-add-expense"
      />
      <QuickAction
        icon="swap-horizontal-outline"
        label={t('finance.overview.transfer')}
        color={colors.accentPurple}
        backgroundColor={colors.accentPurpleSoft}
        onPress={onTransfer}
        testID="finance-quick-transfer"
      />
      <QuickAction
        icon="bar-chart-outline"
        label={t('finance.overview.reports')}
        color={colors.accentGold}
        backgroundColor={colors.accentGoldSoft}
        onPress={onReports}
        testID="finance-quick-reports"
      />
    </View>
  );
}

function QuickAction({
  icon,
  label,
  color,
  backgroundColor,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  backgroundColor: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <View style={[styles.circle, { backgroundColor }]}>
        <Ionicons name={icon} size={IconSize.lg} color={color} />
      </View>
      <AppText variant="caption" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 64,
  },
  pressed: {
    opacity: 0.7,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
