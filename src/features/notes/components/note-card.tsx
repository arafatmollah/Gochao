import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { useTranslation } from '@/i18n';
import { formatIsoDateDisplay } from '@/i18n/format';
import { Colors, IconSize, Spacing } from '@/theme/tokens';
import type { NoteListItem } from '@/types/note';

export interface NoteCardProps {
  note: NoteListItem;
  onPress: () => void;
  onTogglePin: () => void;
  testID?: string;
}

/** List card for one note: title, snippet, category, tags, and modified date. */
export function NoteCard({ note, onPress, onTogglePin, testID }: NoteCardProps) {
  const { t } = useTranslation();
  const title = note.title.trim().length > 0 ? note.title : t('notes.untitled');
  const updatedDate = formatIsoDateDisplay(note.updatedAt.slice(0, 10), t);

  return (
    <Card onPress={onPress} testID={testID} accessibilityLabel={title} style={styles.card}>
      <View style={styles.titleRow}>
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        <Pressable
          onPress={onTogglePin}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={note.isPinned ? t('notes.unpinA11y') : t('notes.pinA11y')}
          testID={testID ? `${testID}-pin` : undefined}>
          <Ionicons
            name={note.isPinned ? 'bookmark' : 'bookmark-outline'}
            size={IconSize.md}
            color={note.isPinned ? Colors.primary : Colors.textMuted}
          />
        </Pressable>
      </View>

      {note.content.trim().length > 0 ? (
        <AppText variant="caption" color="textSecondary" numberOfLines={2}>
          {note.content}
        </AppText>
      ) : null}

      <View style={styles.metaRow}>
        {note.categoryName ? (
          <Badge
            label={note.categoryName}
            color={Colors.textSecondary}
            backgroundColor={Colors.surfaceMuted}
          />
        ) : null}
        {note.tags.map((tag) => (
          <AppText key={tag.id} variant="caption" color="primary" numberOfLines={1}>
            {`#${tag.name}`}
          </AppText>
        ))}
        <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.updated}>
          {t('notes.updatedOn', { date: updatedDate })}
        </AppText>
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
    alignItems: 'center',
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
  updated: {
    marginLeft: 'auto',
  },
});
