import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { useTranslation } from '@/i18n';
import { IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { MedicineWithSchedules } from '@/types/health';

export interface MedicineRowProps {
  medicine: MedicineWithSchedules & { takenThisWeek: number; totalThisWeek: number };
  onPress: (medicine: MedicineWithSchedules) => void;
  testID?: string;
}

export function MedicineRow({ medicine, onPress, testID }: MedicineRowProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
        <Ionicons name="medkit-outline" size={IconSize.md} color={colors.primary} />
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
          color={colors.textMuted}
          backgroundColor={colors.surfaceMuted}
        />
      ) : (
        <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
      )}
    </Pressable>
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
