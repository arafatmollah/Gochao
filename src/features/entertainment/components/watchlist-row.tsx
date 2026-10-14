import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { useTranslation } from '@/i18n';
import { isYouTubeUrl } from '@/services/entertainment-validation';
import { useAppTheme } from '@/theme/theme-context';
import { CardShadow, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import type { WatchItem, WatchKind } from '@/types/entertainment';

export interface WatchlistRowProps {
  item: WatchItem;
  onPress: (item: WatchItem) => void;
  onOpenLink: (url: string) => void;
  testID?: string;
}

const KIND_ICONS: Record<WatchKind, keyof typeof Ionicons.glyphMap> = {
  movie: 'film-outline',
  series: 'tv-outline',
  video: 'logo-youtube',
};

export function WatchlistRow({ item, onPress, onOpenLink, testID }: WatchlistRowProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        testID={testID}
        style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name={KIND_ICONS[item.kind]} size={IconSize.md} color={colors.primary} />
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {item.title}
          </AppText>
          <View style={styles.metaRow}>
            <Badge
              label={t(`entertainment.statuses.${item.status}`)}
              color={statusColor(item.status, colors).fg}
              backgroundColor={statusColor(item.status, colors).bg}
            />
            {item.source === 'tmdb' ? (
              <Badge
                label={t('entertainment.recommendedBadge')}
                color={colors.accentPurple}
                backgroundColor={colors.accentPurpleSoft}
              />
            ) : null}
            {item.rating !== null ? (
              <RatingStars rating={item.rating} />
            ) : (
              <AppText variant="caption" color="textMuted">
                {t(`entertainment.kinds.${item.kind}`)}
              </AppText>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
      </Pressable>

      {item.url ? (
        <Pressable
          onPress={() => onOpenLink(item.url as string)}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={t('entertainment.openLink')}
          testID={testID ? `${testID}-link` : undefined}
          style={styles.linkButton}>
          <Ionicons
            name={isYouTubeUrl(item.url) ? 'logo-youtube' : 'open-outline'}
            size={IconSize.md}
            color={colors.danger}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function statusColor(
  status: WatchItem['status'],
  colors: ThemeColors,
): { fg: string; bg: string } {
  switch (status) {
    case 'watching':
      return { fg: colors.primary, bg: colors.primarySoft };
    case 'watched':
      return { fg: colors.success, bg: colors.successSoft };
    default:
      return { fg: colors.textSecondary, bg: colors.surfaceMuted };
  }
}

export function RatingStars({ rating }: { rating: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stars} accessibilityLabel={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={IconSize.sm}
          color={colors.accentGold}
        />
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.sm,
      paddingLeft: Spacing.sm,
      paddingRight: Spacing.md,
      ...CardShadow,
    },
    body: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      flex: 1,
      gap: Spacing.xs,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    stars: {
      flexDirection: 'row',
      gap: 2,
    },
    linkButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
