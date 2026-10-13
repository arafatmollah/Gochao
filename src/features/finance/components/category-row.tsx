import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { categoryDisplayName, categoryIcon } from '@/features/finance/meta';
import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/theme-context';
import { IconSize, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import type { CategoryWithUsage } from '@/types/finance';

export interface CategoryRowProps {
  category: CategoryWithUsage;
  onPress?: () => void;
  testID?: string;
}

/** One category: icon, display name, badges, and recorded usage count. */
export function CategoryRow({ category, onPress, testID }: CategoryRowProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Card onPress={onPress} testID={testID} accessibilityLabel={categoryDisplayName(category, t)}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name={categoryIcon(category)} size={IconSize.md} color={colors.primary} />
        </View>
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {categoryDisplayName(category, t)}
            </AppText>
            {category.isBuiltin ? (
              <Badge
                label={t('finance.categories.builtinBadge')}
                color={colors.primary}
                backgroundColor={colors.primarySoft}
              />
            ) : null}
            {category.isArchived ? (
              <Badge
                label={t('finance.categories.archivedBadge')}
                color={colors.textSecondary}
                backgroundColor={colors.surfaceMuted}
              />
            ) : null}
          </View>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {t('finance.categories.usage', { count: category.transactionCount })}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={IconSize.sm} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
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
