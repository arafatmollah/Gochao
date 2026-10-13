import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { relationshipLabelKey } from '@/features/family/meta';
import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/theme-context';
import { Spacing } from '@/theme/tokens';
import type { FamilyMember } from '@/types/family';

export interface MemberRowProps {
  member: FamilyMember;
  onPress: () => void;
  testID?: string;
}

/** List row for one family member; archived members are badged and dimmed. */
export function MemberRow({ member, onPress, testID }: MemberRowProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  return (
    <Card
      onPress={onPress}
      testID={testID}
      accessibilityLabel={member.name}
      style={[styles.card, member.isArchived && styles.archived]}>
      <View style={styles.titleRow}>
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
          {member.name}
        </AppText>
        <Badge
          label={t(relationshipLabelKey(member.relationship))}
          color={colors.textSecondary}
          backgroundColor={colors.surfaceMuted}
          testID={testID ? `${testID}-relationship` : undefined}
        />
        {member.isArchived ? (
          <Badge
            label={t('family.archived')}
            color={colors.textMuted}
            backgroundColor={colors.surfaceMuted}
            testID={testID ? `${testID}-archived` : undefined}
          />
        ) : null}
      </View>
      {member.contact ? (
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
          {member.contact}
        </AppText>
      ) : null}
      {member.notes ? (
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {member.notes}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  name: {
    flex: 1,
    minWidth: 96,
  },
  archived: {
    opacity: 0.72,
  },
});
