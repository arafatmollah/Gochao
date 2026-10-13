import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { formatIsoDateDisplay, formatWallClock12 } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { CardShadow, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { Appointment, HealthRecord } from '@/types/health';

export interface AppointmentRowProps {
  appointment: Appointment;
  onPress: (appointment: Appointment) => void;
  testID?: string;
}

export function AppointmentRow({ appointment, onPress, testID }: AppointmentRowProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const when = appointment.time
    ? `${formatIsoDateDisplay(appointment.date, t)}, ${formatWallClock12(appointment.time, locale)}`
    : formatIsoDateDisplay(appointment.date, t);
  const where = [appointment.doctor, appointment.place]
    .filter((part) => part !== null && part !== '')
    .join(' · ');

  return (
    <Pressable
      onPress={() => onPress(appointment)}
      accessibilityRole="button"
      accessibilityLabel={appointment.title}
      testID={testID}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.icon}>
        <Ionicons name="calendar-outline" size={IconSize.md} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {appointment.title}
        </AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
          {when}
        </AppText>
        {where !== '' ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {where}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={IconSize.md} color={colors.textMuted} />
    </Pressable>
  );
}

export interface HealthNoteCardProps {
  record: HealthRecord;
  onPress: (record: HealthRecord) => void;
  testID?: string;
}

export function HealthNoteCard({ record, onPress, testID }: HealthNoteCardProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={() => onPress(record)}
      accessibilityRole="button"
      accessibilityLabel={record.title}
      testID={testID}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {record.title}
        </AppText>
        {record.content ? (
          <AppText variant="body" color="textSecondary" numberOfLines={3}>
            {record.content}
          </AppText>
        ) : null}
        <AppText variant="caption" color="textMuted">
          {formatIsoDateDisplay(record.recordedOn, t)}
        </AppText>
      </View>
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
      ...CardShadow,
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
