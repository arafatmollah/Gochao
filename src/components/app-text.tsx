import { Text, type TextProps, type TextStyle } from 'react-native';

import { Colors, Typography, type ColorName, type TypographyVariant } from '@/theme/tokens';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: ColorName;
  align?: TextStyle['textAlign'];
}

export function AppText({
  variant = 'body',
  color = 'text',
  align,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      style={[Typography[variant], { color: Colors[color] }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}
