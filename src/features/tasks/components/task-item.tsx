import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { formatIsoDateRelative } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { CardShadow, IconSize, Radius, Spacing, priorityColors } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import type { Task } from '@/types/task';

export interface TaskItemProps {
  task: Task;
  today: string;
  onPress: (task: Task) => void;
  onToggle: (task: Task) => void;
}

export function TaskItem({ task, today, onPress, onToggle }: TaskItemProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isCompleted = task.status === 'completed';
  const dueTone = dueDateTone(task, today, colors);
  const taskPriorityColors = priorityColors(colors)[task.priority];

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onToggle(task)}
        hitSlop={8}
        accessibilityRole="checkbox"
        aria-checked={isCompleted}
        accessibilityLabel={
          isCompleted
            ? t('tasks.item.reopen', { title: task.title })
            : t('tasks.item.markComplete', { title: task.title })
        }
        testID={`task-checkbox-${task.id}`}
        style={styles.checkbox}>
        <Ionicons
          name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
          size={IconSize.lg}
          color={isCompleted ? colors.primary : colors.borderStrong}
        />
      </Pressable>

      <Pressable
        onPress={() => onPress(task)}
        accessibilityRole="button"
        accessibilityLabel={task.title}
        accessibilityHint={t('tasks.item.openHint')}
        testID={`task-row-${task.id}`}
        style={styles.body}>
        <AppText
          variant="bodyStrong"
          color={isCompleted ? 'textMuted' : 'text'}
          style={isCompleted ? styles.completedTitle : undefined}
          numberOfLines={2}>
          {task.title}
        </AppText>

        <View style={styles.metaRow}>
          {isCompleted && task.completedAt ? (
            <MetaItem
              icon="checkmark-outline"
              label={t('tasks.item.completedRelative', {
                relative: formatIsoDateRelative(task.completedAt.slice(0, 10), today, t),
              })}
              color={colors.textMuted}
            />
          ) : task.dueAt ? (
            <MetaItem
              icon="calendar-outline"
              label={formatIsoDateRelative(task.dueAt, today, t)}
              color={dueTone}
            />
          ) : null}

          {task.description ? (
            <MetaItem icon="document-text-outline" label={t('tasks.item.notes')} color={colors.textMuted} />
          ) : null}

          {!isCompleted ? (
            <Badge
              label={t(`priority.${task.priority}`)}
              color={taskPriorityColors.fg}
              backgroundColor={taskPriorityColors.bg}
            />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function dueDateTone(task: Task, today: string, colors: ThemeColors): string {
  if (!task.dueAt) {
    return colors.textMuted;
  }
  if (task.dueAt < today) {
    return colors.danger;
  }
  if (task.dueAt === today) {
    return colors.warning;
  }
  return colors.textSecondary;
}

function MetaItem({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={IconSize.sm - 2} color={color} />
      <AppText variant="caption" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.md,
      paddingLeft: Spacing.sm,
      paddingRight: Spacing.md,
      ...CardShadow,
    },
    checkbox: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      gap: Spacing.xs,
      paddingTop: Spacing.sm,
      minHeight: 40,
    },
    completedTitle: {
      textDecorationLine: 'line-through',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
  });
