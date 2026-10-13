import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import type { SpotlightWithSaved } from '@/features/entertainment/hooks/use-entertainment';
import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/theme-context';
import { CardShadow, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';

export interface SpotlightCardProps {
  entry: SpotlightWithSaved;
  onAdd: (entry: SpotlightWithSaved) => void;
  testID?: string;
}

export function SpotlightCard({ entry, onAdd, testID }: SpotlightCardProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.icon}>
        <Ionicons
          name={entry.section === 'upcoming' ? 'rocket-outline' : 'trophy-outline'}
          size={IconSize.md}
          color={entry.section === 'upcoming' ? colors.accentPurple : colors.accentGold}
        />
      </View>
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {entry.title}
        </AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
          {t(`entertainment.kinds.${entry.kind}`)} · {entry.year}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={2}>
          {entry.blurb}
        </AppText>
      </View>
      {entry.saved ? (
        <Badge
          label={t('entertainment.addedBadge')}
          color={colors.success}
          backgroundColor={colors.successSoft}
        />
      ) : (
        <Pressable
          onPress={() => onAdd(entry)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${t('entertainment.addToList')}: ${entry.title}`}
          testID={testID ? `${testID}-add` : undefined}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
          <Ionicons name="add" size={IconSize.md} color={colors.onPrimary} />
          <AppText variant="label" style={styles.addLabel}>
            {t('entertainment.addToList')}
          </AppText>
        </Pressable>
      )}
    </View>
  );
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
    icon: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      gap: 2,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    addButtonPressed: {
      backgroundColor: colors.primaryPressed,
    },
    addLabel: {
      color: colors.onPrimary,
    },
  });
