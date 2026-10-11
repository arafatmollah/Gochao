import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Colors, ControlSize, Radius, Spacing } from '@/theme/tokens';

import { AppText } from './app-text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const textColor = buttonTextColor(variant);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      aria-disabled={isDisabled}
      aria-busy={loading}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sizeSm : styles.sizeMd,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && pressedStyles[variant],
        isDisabled && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <AppText variant="button" style={{ color: textColor }}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

function buttonTextColor(variant: ButtonVariant): string {
  switch (variant) {
    case 'primary':
      return Colors.onPrimary;
    case 'secondary':
      return Colors.text;
    case 'ghost':
      return Colors.primary;
    case 'danger':
      return Colors.danger;
  }
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    minHeight: ControlSize.minTouchTarget,
  },
  sizeMd: {
    height: ControlSize.buttonHeightMd,
  },
  sizeSm: {
    height: ControlSize.buttonHeightSm,
    paddingHorizontal: Spacing.md,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.dangerSoft,
  },
});

const pressedStyles = StyleSheet.create({
  primary: {
    backgroundColor: Colors.primaryPressed,
  },
  secondary: {
    backgroundColor: Colors.surfaceMuted,
  },
  ghost: {
    backgroundColor: Colors.primarySoft,
  },
  danger: {
    backgroundColor: '#EFD8D2',
  },
});
