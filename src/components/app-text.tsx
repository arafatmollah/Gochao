import { Text, type TextProps, type TextStyle } from 'react-native';

import { Typography, type ColorName, type TypographyVariant } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-context';
import { useDisplay } from '@/theme/display-context';

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
  const { textScale } = useDisplay();
  const base = Typography[variant];
  return (
    <Text
      style={[
        {
          ...base,
          fontSize: (base.fontSize ?? 15) * textScale,
          lineHeight: (base.lineHeight ?? 20) * textScale,
        },
        { color: colors[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}
