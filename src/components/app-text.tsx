import { Text, type TextProps, type TextStyle } from 'react-native';

import { Typography, type ColorName, type TypographyVariant } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';

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
  const { colors } = useAppTheme();
  return (
    <Text
      style={[Typography[variant], { color: colors[color] }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}
