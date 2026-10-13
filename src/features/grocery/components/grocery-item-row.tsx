import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTranslation } from '@/i18n';
import { formatMoney } from '@/i18n/format';
import { CardShadow, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { GroceryItemWithMember } from '@/types/grocery';

export interface GroceryItemRowProps {
  item: GroceryItemWithMember;
  onPress: (item: GroceryItemWithMember) => void;
  onToggle: (item: GroceryItemWithMember) => void;
  testID?: string;
}

export function GroceryItemRow({ item, onPress, onToggle, testID }: GroceryItemRowProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const purchased = item.isPurchased;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onToggle(item)}
        hitSlop={8}
        accessibilityRole="checkbox"
        aria-checked={purchased}
        accessibilityLabel={
          purchased
            ? t('grocery.item.reopen', { name: item.name })
            : t('grocery.item.markPurchased', { name: item.name })
        }
        testID={testID ? `${testID}-checkbox` : undefined}
        style={styles.checkbox}>
        <Ionicons
          name={purchased ? 'checkmark-circle' : 'ellipse-outline'}
          size={IconSize.lg}
          color={purchased ? colors.primary : colors.borderStrong}
        />
      </Pressable>

      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        accessibilityHint={t('grocery.item.openHint')}
        testID={testID}
        style={styles.body}>
        <AppText
          variant="bodyStrong"
          color={purchased ? 'textMuted' : 'text'}
          style={purchased ? styles.purchasedName : undefined}
          numberOfLines={2}>
          {item.name}
        </AppText>

        <View style={styles.metaRow}>
          <MetaItem
            icon="basket-outline"
            label={formatQuantity(item)}
            color={colors.textSecondary}
          />
          {item.estimatedPriceMinor !== null && item.estimatedPriceMinor > 0 ? (
            <MetaItem
              icon="pricetag-outline"
              label={t('grocery.item.estimated', {
                amount: formatMoney(item.estimatedPriceMinor, locale),
              })}
              color={colors.textSecondary}
            />
          ) : null}
          {item.actualPriceMinor !== null && item.actualPriceMinor > 0 ? (
            <MetaItem
              icon="cash-outline"
              label={t('grocery.item.actual', {
                amount: formatMoney(item.actualPriceMinor, locale),
              })}
              color={colors.textSecondary}
            />
          ) : null}
          {item.assignedMemberName ? (
            <MetaItem
              icon="person-outline"
              label={t('grocery.item.assignedTo', { name: item.assignedMemberName })}
              color={colors.textMuted}
            />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function formatQuantity(item: GroceryItemWithMember): string {
  const quantity = String(item.quantity);
  return item.unit ? `${quantity} ${item.unit}` : quantity;
}

function MetaItem({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={IconSize.sm - 2} color={color} />
      <AppText variant="caption" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.md,
      paddingLeft: Spacing.sm,
      paddingRight: Spacing.md,
      ...CardShadow,
    },
    checkbox: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      gap: Spacing.xs,
      paddingTop: Spacing.sm,
      minHeight: 40,
    },
    purchasedName: {
      textDecorationLine: 'line-through',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
  });
