import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { useTranslation } from '@/i18n';
import { Colors, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { MedicineWithSchedules } from '@/types/health';

export interface MedicineRowProps {
  medicine: MedicineWithSchedules & { takenThisWeek: number; totalThisWeek: number };
  onPress: (medicine: MedicineWithSchedules) => void;
  testID?: string;
}

export function MedicineRow({ medicine, onPress, testID }: MedicineRowProps) {
  const { t } = useTranslation();

  const scheduleLine =
    medicine.schedules.length === 0
      ? t('health.noSchedules')
      : medicine.schedules
          .map((schedule) => schedule.time)
          .sort()
          .join(' · ');

  const subtitle = [medicine.strength, t(`health.frequencies.${medicine.frequency}`)]
    .filter((part) => part !== null && part !== '')
    .join(' · ');

  return (
    <Pressable
      onPress={() => onPress(medicine)}
      accessibilityRole="button"
      accessibilityLabel={medicine.name}
      testID={testID}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.icon}>
        <Ionicons name="medkit-outline" size={IconSize.md} color={Colors.primary} />
      </View>
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {medicine.name}
        </AppText>
        {subtitle !== '' ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
          {scheduleLine}
        </AppText>
        {medicine.totalThisWeek > 0 ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {t('health.adherence', {
              taken: medicine.takenThisWeek,
              total: medicine.totalThisWeek,
            })}
          </AppText>
        ) : null}
      </View>
      {medicine.isArchived ? (
        <Badge
          label={t('health.archivedBadge')}
          color={Colors.textMuted}
          backgroundColor={Colors.surfaceMuted}
        />
      ) : (
        <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
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
