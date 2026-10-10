import { StyleSheet } from 'react-native';

import { colors, radius, size, space, type ColorName } from '@/theme';

import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

type Props = {
  label: string;
  onPress?: () => void;
  /** Text colour, for example `destructive` on "End". */
  color?: ColorName;
  accessibilityHint?: string;
};

export function SecondaryButton({ label, onPress, color = 'textPrimary', accessibilityHint }: Props) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={styles.button}
      onPress={onPress}
    >
      <Txt variant="button" color={color} maxFontSizeMultiplier={1.3} numberOfLines={1}>
        {label}
      </Txt>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: size.button,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.secondaryButtonBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
  },
});
