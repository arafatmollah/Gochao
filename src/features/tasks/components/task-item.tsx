import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { formatIsoDateRelative } from '@/i18n/format';
import { useTranslation } from '@/i18n';
import { CardShadow, Colors, IconSize, PriorityColors, Radius, Spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

export interface TaskItemProps {
  task: Task;
  today: string;
  onPress: (task: Task) => void;
  onToggle: (task: Task) => void;
}

export function TaskItem({ task, today, onPress, onToggle }: TaskItemProps) {
  const { t } = useTranslation();
  const isCompleted = task.status === 'completed';
  const dueTone = dueDateTone(task, today);
  const priorityColors = PriorityColors[task.priority];

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
          color={isCompleted ? Colors.primary : Colors.borderStrong}
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
              color={Colors.textMuted}
            />
          ) : task.dueAt ? (
            <MetaItem
              icon="calendar-outline"
              label={formatIsoDateRelative(task.dueAt, today, t)}
              color={dueTone}
            />
          ) : null}

          {task.description ? (
            <MetaItem icon="document-text-outline" label={t('tasks.item.notes')} color={Colors.textMuted} />
          ) : null}

          {!isCompleted ? (
            <Badge
              label={t(`priority.${task.priority}`)}
              color={priorityColors.fg}
              backgroundColor={priorityColors.bg}
            />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function dueDateTone(task: Task, today: string): string {
  if (!task.dueAt) {
    return Colors.textMuted;
  }
  if (task.dueAt < today) {
    return Colors.danger;
  }
  if (task.dueAt === today) {
    return Colors.warning;
  }
  return Colors.textSecondary;
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
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={IconSize.sm - 2} color={color} />
      <AppText variant="caption" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
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
