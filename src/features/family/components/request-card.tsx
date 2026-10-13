import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { requestCategoryLabelKey, requestStatusLabelKey } from '@/features/family/meta';
import { useTranslation } from '@/i18n';
import { formatIsoDateDisplay, formatMoney } from '@/i18n/format';
import { useAppTheme } from '@/theme/theme-context';
import { Spacing, priorityColors } from '@/theme/tokens';
import type { FamilyRequestListItem } from '@/types/family';

export interface RequestCardProps {
  request: FamilyRequestListItem;
  onPress: () => void;
  testID?: string;
}

/**
 * List card for one family request: title with status badge, details
 * snippet, category, member, deadline, and estimated cost.
 */
export function RequestCard({ request, onPress, testID }: RequestCardProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const priorityTone = priorityColors(colors)[request.priority];

  return (
    <Card onPress={onPress} testID={testID} accessibilityLabel={request.title} style={styles.card}>
      <View style={styles.titleRow}>
        <AppText variant="bodyStrong" numberOfLines={2} style={styles.title}>
          {request.title}
        </AppText>
        <Badge
          label={t(requestStatusLabelKey(request.status))}
          color={priorityTone.fg}
          backgroundColor={priorityTone.bg}
          testID={testID ? `${testID}-status` : undefined}
        />
      </View>

      {request.details ? (
        <AppText variant="caption" color="textSecondary" numberOfLines={2}>
          {request.details}
        </AppText>
      ) : null}

      <View style={styles.metaRow}>
        <Badge
          label={t(requestCategoryLabelKey(request.category))}
          color={colors.textSecondary}
          backgroundColor={colors.surfaceMuted}
        />
        {request.memberName ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {request.memberName}
          </AppText>
        ) : null}
        {request.deadline ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {formatIsoDateDisplay(request.deadline, t)}
          </AppText>
        ) : null}
        {request.estimatedCostMinor !== null ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.cost}>
            {formatMoney(request.estimatedCostMinor, locale)}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingTop: 2,
  },
  cost: {
    marginLeft: 'auto',
  },
});
