import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/theme-context';
import { IconSize, Spacing } from '@/theme/tokens';

export interface QuickActionsProps {
  onAddTask: () => void;
  onAddIncome: () => void;
  onAddExpense: () => void;
  onViewBills: () => void;
  onAddFamilyRequest: () => void;
  testID?: string;
}

/**
 * Round quick actions under the hero card. Only actions backed by real
 * functionality are shown; they must never be dead buttons. The row scrolls
 * horizontally on narrow screens (five `minWidth` actions overflow ~320px
 * layouts) while spreading full-width where it fits.
 */
export function QuickActions({
  onAddTask,
  onAddIncome,
  onAddExpense,
  onViewBills,
  onAddFamilyRequest,
  testID,
}: QuickActionsProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID={testID}>
      <QuickAction
        icon="add"
        label={t('dashboard.addTask')}
        color={colors.primary}
        backgroundColor={colors.primarySoft}
        onPress={onAddTask}
        testID="quick-add-task"
      />
      <QuickAction
        icon="arrow-down-circle-outline"
        label={t('finance.overview.addIncome')}
        color={colors.success}
        backgroundColor={colors.successSoft}
        onPress={onAddIncome}
        testID="quick-add-income"
      />
      <QuickAction
        icon="arrow-up-circle-outline"
        label={t('finance.overview.addExpense')}
        color={colors.danger}
        backgroundColor={colors.dangerSoft}
        onPress={onAddExpense}
        testID="quick-add-expense"
      />
      <QuickAction
        icon="receipt-outline"
        label={t('nav.bills')}
        color={colors.accentPurple}
        backgroundColor={colors.accentPurpleSoft}
        onPress={onViewBills}
        testID="quick-view-bills"
      />
      <QuickAction
        icon="people-outline"
        label={t('dashboard.quickFamily')}
        color={colors.accentGold}
        backgroundColor={colors.accentGoldSoft}
        onPress={onAddFamilyRequest}
        testID="quick-add-family-request"
      />
    </ScrollView>
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
    flexGrow: 1,
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 72,
  },
  pressed: {
    opacity: 0.7,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
