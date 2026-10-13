import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTranslation } from '@/i18n';
import { formatMoney } from '@/i18n/format';
import type { Locale, TranslateFn } from '@/i18n/translate';
import { CardShadow, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { GroceryListSummary } from '@/types/grocery';

export interface GroceryListCardProps {
  list: GroceryListSummary;
  onPress: (list: GroceryListSummary) => void;
  testID?: string;
}

export function GroceryListCard({ list, onPress, testID }: GroceryListCardProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
          color={colors.primary}
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
      <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      ...CardShadow,
    },
    cardPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      gap: 2,
    },
  });
