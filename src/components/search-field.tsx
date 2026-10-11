import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View, Pressable } from 'react-native';

import { useTranslation } from '@/i18n';
import { Colors, IconSize, Radius, Spacing, Typography } from '@/theme/tokens';

export interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  testID?: string;
}

export function SearchField({ value, onChangeText, placeholder, testID }: SearchFieldProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={IconSize.md - 2} color={Colors.textMuted} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t('tasks.searchPlaceholder')}
        placeholderTextColor={Colors.textMuted}
        accessibilityLabel={t('common.search')}
        returnKeyType="search"
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.clearSearch')}>
          <Ionicons name="close-circle" size={IconSize.md} color={Colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    minHeight: 46,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
});
