import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { formatIsoDateDisplay, formatWallClock12 } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { CardShadow, Colors, IconSize, Radius, Spacing } from '@/theme/tokens';
import type { Appointment, HealthRecord } from '@/types/health';

export interface AppointmentRowProps {
  appointment: Appointment;
  onPress: (appointment: Appointment) => void;
  testID?: string;
}

export function AppointmentRow({ appointment, onPress, testID }: AppointmentRowProps) {
  const { t, locale } = useTranslation();

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
        <Ionicons name="calendar-outline" size={IconSize.md} color={Colors.primary} />
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
      <Ionicons name="chevron-forward" size={IconSize.md} color={Colors.textMuted} />
    </Pressable>
  );
}

export interface HealthNoteCardProps {
  record: HealthRecord;
  onPress: (record: HealthRecord) => void;
  testID?: string;
}

export function HealthNoteCard({ record, onPress, testID }: HealthNoteCardProps) {
  const { t } = useTranslation();

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

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...CardShadow,
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
