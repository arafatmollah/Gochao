import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { useTranslation } from '@/i18n';
import { Colors, Radius, Spacing, Typography } from '@/theme/tokens';

import { AppText } from './app-text';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  optional?: boolean;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  maxLength?: number;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  testID?: string;
  accessibilityHint?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  optional = false,
  multiline = false,
  keyboardType,
  autoFocus = false,
  maxLength,
  returnKeyType,
  onSubmitEditing,
  testID,
  accessibilityHint,
}: TextFieldProps) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? Colors.danger
    : focused
      ? Colors.primary
      : Colors.border;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <AppText variant="label" color="textSecondary">
          {label}
        </AppText>
        {optional ? (
          <AppText variant="caption" color="textMuted">
            {t('common.optional')}
          </AppText>
        ) : null}
      </View>

      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        maxLength={maxLength}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          { borderColor },
        ]}
      />

      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : helperText(value, maxLength) ? (
        <AppText variant="caption" color="textMuted" align="right">
          {helperText(value, maxLength)}
        </AppText>
      ) : null}
    </View>
  );
}

function helperText(value: string, maxLength?: number): string | null {
  if (!maxLength || value.length < maxLength * 0.75) {
    return null;
  }
  return `${value.length}/${maxLength}`;
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    ...Typography.body,
    color: Colors.text,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    textAlignVertical: 'top',
  },
});
