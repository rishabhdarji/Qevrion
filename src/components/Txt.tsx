import { Text, type TextProps } from 'react-native';

import { colors, type, type ColorName, type TypeName } from '@/theme';

type Props = TextProps & {
  variant?: TypeName;
  color?: ColorName;
};

// All app text goes through here so type styles, colours and the Dynamic Type cap
// live in one place. Text still grows with the system setting, up to 1.6x.
export function Txt({ variant = 'body', color = 'textPrimary', style, ...rest }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[type[variant], { color: colors[color] }, style]}
    />
  );
}
