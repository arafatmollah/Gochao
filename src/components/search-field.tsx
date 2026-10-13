import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, TextInput, View, Pressable } from 'react-native';

import { useTranslation } from '@/i18n';
import { IconSize, Radius, Spacing, Typography } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

export interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  testID?: string;
}

export function SearchField({ value, onChangeText, placeholder, autoFocus, testID }: SearchFieldProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={IconSize.md - 2} color={colors.textMuted} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t('tasks.searchPlaceholder')}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t('common.search')}
        returnKeyType="search"
        autoFocus={autoFocus}
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.clearSearch')}>
          <Ionicons name="close-circle" size={IconSize.md} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.lg,
      minHeight: 46,
    },
    input: {
      flex: 1,
      ...Typography.body,
      color: colors.text,
      paddingVertical: Spacing.sm,
    },
  });
