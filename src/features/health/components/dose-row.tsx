import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTranslation } from '@/i18n';
import { formatWallClock12 } from '@/i18n/format';
import { CardShadow, Colors, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { DueDose } from '@/types/health';

export interface DoseRowProps {
  dose: DueDose;
  onLogTaken: (dose: DueDose) => void;
  onLogSkipped: (dose: DueDose) => void;
  onClear: (dose: DueDose) => void;
  testID?: string;
}

export function DoseRow({ dose, onLogTaken, onLogSkipped, onClear, testID }: DoseRowProps) {
  const { t, locale } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.timeBadge}>
        <AppText variant="label" style={styles.timeText}>
          {formatWallClock12(dose.time, locale)}
        </AppText>
      </View>

      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {dose.medicineName}
        </AppText>
        {dose.dosage ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={2}>
            {dose.dosage}
          </AppText>
        ) : null}
        {dose.status ? (
          <AppText
            variant="caption"
            style={{ color: dose.status === 'taken' ? Colors.success : Colors.warning }}>
            {t(`health.dose.${dose.status}`)}
          </AppText>
        ) : null}
      </View>

      {dose.status === null ? (
        <>
          <DoseButton
            icon="checkmark-outline"
            color={Colors.success}
            backgroundColor={Colors.successSoft}
            accessibilityLabel={t('health.dose.markTaken', {
              name: dose.medicineName,
              time: formatWallClock12(dose.time, locale),
            })}
            onPress={() => onLogTaken(dose)}
            testID={testID ? `${testID}-taken` : undefined}
          />
          <DoseButton
            icon="close-outline"
            color={Colors.warning}
            backgroundColor={Colors.warningSoft}
            accessibilityLabel={t('health.dose.markSkipped', {
              name: dose.medicineName,
              time: formatWallClock12(dose.time, locale),
            })}
            onPress={() => onLogSkipped(dose)}
            testID={testID ? `${testID}-skipped` : undefined}
          />
        </>
      ) : (
        <DoseButton
          icon="refresh-outline"
          color={Colors.textSecondary}
          backgroundColor={Colors.surfaceMuted}
          accessibilityLabel={t('health.dose.clearDose', {
            name: dose.medicineName,
            time: formatWallClock12(dose.time, locale),
          })}
          onPress={() => onClear(dose)}
          testID={testID ? `${testID}-clear` : undefined}
        />
      )}
    </View>
  );
}

function DoseButton({
  icon,
  color,
  backgroundColor,
  accessibilityLabel,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.action, { backgroundColor }]}>
      <Ionicons name={icon} size={IconSize.md} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...CardShadow,
  },
  timeBadge: {
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  timeText: {
    color: Colors.primary,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  action: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
