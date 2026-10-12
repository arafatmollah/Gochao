import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTranslation } from '@/i18n';
import { formatMoney } from '@/i18n/format';
import type { Locale, TranslateFn } from '@/i18n/translate';
import { CardShadow, Colors, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { GroceryListSummary } from '@/types/grocery';

export interface GroceryListCardProps {
  list: GroceryListSummary;
  onPress: (list: GroceryListSummary) => void;
  testID?: string;
}

export function GroceryListCard({ list, onPress, testID }: GroceryListCardProps) {
  const { t, locale } = useTranslation();
  const done = list.totalItems > 0 && list.remainingItems === 0;

  const statusLine =
    list.totalItems === 0
      ? t('grocery.noItems')
      : list.remainingItems === 0
        ? t('grocery.allPurchased')
        : t('grocery.remaining', { count: list.remainingItems });

  return (
    <Pressable
      onPress={() => onPress(list)}
      accessibilityRole="button"
      accessibilityLabel={list.name}
      testID={testID}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.icon}>
        <Ionicons
          name={list.isArchived ? 'archive-outline' : 'cart-outline'}
          size={IconSize.md}
          color={Colors.primary}
        />
      </View>
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {list.name}
        </AppText>
        <AppText
          variant="caption"
          color={done ? 'textMuted' : 'textSecondary'}
          numberOfLines={1}>
          {statusLine}
        </AppText>
        {list.estimatedTotalMinor > 0 || list.actualTotalMinor > 0 ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {totalsLine(list, t, locale)}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.textMuted} />
    </Pressable>
  );
}

function totalsLine(list: GroceryListSummary, t: TranslateFn, locale: Locale): string {
  const parts: string[] = [];
  if (list.estimatedTotalMinor > 0) {
    parts.push(
      `${t('grocery.estimatedTotal')}: ${formatMoney(list.estimatedTotalMinor, locale)}`,
    );
  }
  if (list.actualTotalMinor > 0) {
    parts.push(`${t('grocery.actualTotal')}: ${formatMoney(list.actualTotalMinor, locale)}`);
  }
  return parts.join(' · ');
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...CardShadow,
  },
  cardPressed: {
    backgroundColor: Colors.surfaceMuted,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
});
