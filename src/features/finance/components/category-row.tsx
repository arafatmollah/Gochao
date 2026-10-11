import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { categoryDisplayName, categoryIcon } from '@/features/finance/meta';
import { useTranslation } from '@/i18n';
import { Colors, IconSize, Spacing } from '@/theme/tokens';
import type { CategoryWithUsage } from '@/types/finance';

export interface CategoryRowProps {
  category: CategoryWithUsage;
  onPress?: () => void;
  testID?: string;
}

/** One category: icon, display name, badges, and recorded usage count. */
export function CategoryRow({ category, onPress, testID }: CategoryRowProps) {
  const { t } = useTranslation();

  return (
    <Card onPress={onPress} testID={testID} accessibilityLabel={categoryDisplayName(category, t)}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name={categoryIcon(category)} size={IconSize.md} color={Colors.primary} />
        </View>
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {categoryDisplayName(category, t)}
            </AppText>
            {category.isBuiltin ? (
              <Badge
                label={t('finance.categories.builtinBadge')}
                color={Colors.primary}
                backgroundColor={Colors.primarySoft}
              />
            ) : null}
            {category.isArchived ? (
              <Badge
                label={t('finance.categories.archivedBadge')}
                color={Colors.textSecondary}
                backgroundColor={Colors.surfaceMuted}
              />
            ) : null}
          </View>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {t('finance.categories.usage', { count: category.transactionCount })}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={IconSize.sm} color={Colors.textMuted} />
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
