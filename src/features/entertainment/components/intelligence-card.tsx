import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { daysUntil } from '@/services/entertainment-sync';
import { useTranslation } from '@/i18n';
import { formatIsoDateDisplay } from '@/i18n/format';
import { useAppTheme } from '@/theme/theme-context';
import { CardShadow, IconSize, Radius, Spacing, type ThemeColors } from '@/theme/tokens';
import { todayIsoDate } from '@/utils/dates';

export interface IntelligenceItem {
  id: string;
  tmdbId?: number;
  title: string;
  kind: 'movie' | 'series' | 'video';
  overview?: string;
  releaseDate?: string | null;
  episodeLabel?: string;
  voteAverage?: number;
  providers?: string[];
  watchRegion?: string;
  isMarvel?: boolean;
  phase?: string | null;
  matchReason?: string;
  saved?: boolean;
}

export interface IntelligenceCardProps {
  item: IntelligenceItem;
  onAdd: (item: IntelligenceItem) => void;
  testID?: string;
}

function countdownLabel(dateIso: string | null | undefined, t: (key: string, params?: Record<string, string | number>) => string): string | null {
  if (!dateIso) return null;
  const today = todayIsoDate();
  const diff = daysUntil(today, dateIso);
  if (diff < 0) {
    return t('entertainment.outNow');
  }
  if (diff === 0) {
    return t('entertainment.today');
  }
  if (diff === 1) {
    return t('entertainment.tomorrow');
  }
  if (diff <= 30) {
    return t('entertainment.inDays', { count: diff });
  }
  return formatIsoDateDisplay(dateIso, t);
}

export function IntelligenceCard({ item, onAdd, testID }: IntelligenceCardProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const countdown = countdownLabel(item.releaseDate, t);

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.topRow}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={
              item.isMarvel
                ? 'shield-checkmark-outline'
                : item.kind === 'series'
                  ? 'tv-outline'
                  : 'film-outline'
            }
            size={IconSize.md}
            color={item.isMarvel ? colors.accentPurple : colors.primary}
          />
        </View>

        <View style={styles.headerInfo}>
          <View style={styles.badgeRow}>
            {item.isMarvel ? (
              <Badge
                label={item.phase || 'Marvel'}
                color={colors.accentPurple}
                backgroundColor={colors.surfaceMuted}
              />
            ) : null}
            <Badge
              label={t(`entertainment.kinds.${item.kind}`)}
              color={colors.textSecondary}
              backgroundColor={colors.surfaceMuted}
            />
            {item.providers && item.providers.length > 0 ? (
              <Badge
                label={
                  item.providers[0] === 'netflix'
                    ? 'Netflix · BD'
                    : item.providers[0] === 'prime'
                      ? 'Prime · BD'
                      : 'Max'
                }
                color={colors.primary}
                backgroundColor={colors.primarySoft}
              />
            ) : null}
            {countdown ? (
              <Badge
                label={countdown}
                color={colors.accentGold}
                backgroundColor={colors.surfaceMuted}
              />
            ) : null}
          </View>

          <AppText variant="bodyStrong" numberOfLines={2} style={styles.title}>
            {item.title}
          </AppText>
        </View>
      </View>

      {item.episodeLabel ? (
        <View style={styles.episodeContainer}>
          <Ionicons name="play-circle-outline" size={IconSize.sm} color={colors.primary} />
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {item.episodeLabel}
          </AppText>
        </View>
      ) : null}

      {item.matchReason || item.overview ? (
        <AppText variant="caption" color="textMuted" numberOfLines={2} style={styles.overview}>
          {item.matchReason || item.overview}
        </AppText>
      ) : null}

      <View style={styles.footerRow}>
        <View style={styles.ratingBox}>
          {item.voteAverage && item.voteAverage > 0 ? (
            <>
              <Ionicons name="star" size={14} color={colors.accentGold} />
              <AppText variant="caption" color="textSecondary">
                {item.voteAverage.toFixed(1)}
              </AppText>
            </>
          ) : (
            <AppText variant="caption" color="textMuted">
              {item.releaseDate ? item.releaseDate.slice(0, 4) : t('entertainment.unannounced')}
            </AppText>
          )}
        </View>

        {item.saved ? (
          <Badge
            label={t('entertainment.addedBadge')}
            color={colors.success}
            backgroundColor={colors.successSoft}
          />
        ) : (
          <Pressable
            onPress={() => onAdd(item)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${t('entertainment.addToList')}: ${item.title}`}
            testID={testID ? `${testID}-add` : undefined}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
            <Ionicons name="add" size={IconSize.sm} color={colors.onPrimary} />
            <AppText variant="label" style={styles.addLabel}>
              {t('entertainment.addToList')}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
      ...CardShadow,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: Radius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    headerInfo: {
      flex: 1,
      gap: 4,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    title: {
      fontSize: 15,
      marginTop: 2,
    },
    episodeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: Radius.sm,
    },
    overview: {
      lineHeight: 18,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: Spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    ratingBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
    },
    addButtonPressed: {
      backgroundColor: colors.primaryPressed,
    },
    addLabel: {
      color: colors.onPrimary,
      fontSize: 12,
    },
  });
