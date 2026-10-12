import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { useTranslation } from '@/i18n';
import { isYouTubeUrl } from '@/services/entertainment-validation';
import { CardShadow, Colors, IconSize, Radius, Spacing } from '@/theme/tokens';
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
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        testID={testID}
        style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name={KIND_ICONS[item.kind]} size={IconSize.md} color={Colors.primary} />
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {item.title}
          </AppText>
          <View style={styles.metaRow}>
            <Badge
              label={t(`entertainment.statuses.${item.status}`)}
              color={statusColor(item.status).fg}
              backgroundColor={statusColor(item.status).bg}
            />
            {item.rating !== null ? (
              <RatingStars rating={item.rating} />
            ) : (
              <AppText variant="caption" color="textMuted">
                {t(`entertainment.kinds.${item.kind}`)}
              </AppText>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.textMuted} />
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
            color={Colors.danger}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function statusColor(status: WatchItem['status']): { fg: string; bg: string } {
  switch (status) {
    case 'watching':
      return { fg: Colors.primary, bg: Colors.primarySoft };
    case 'watched':
      return { fg: Colors.success, bg: Colors.successSoft };
    default:
      return { fg: Colors.textSecondary, bg: Colors.surfaceMuted };
  }
}

export function RatingStars({ rating }: { rating: number }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={IconSize.sm}
          color={Colors.accentGold}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.primarySoft,
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
