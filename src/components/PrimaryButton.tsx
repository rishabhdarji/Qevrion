import { StyleSheet } from 'react-native';

import { tap } from '@/lib/haptics';
import { colors, radius, size, space } from '@/theme';

import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

type Props = {
  label: string;
  onPress?: () => void;
  accessibilityHint?: string;
  /** Dimmed and does nothing. Say beside it what it is waiting for. */
  disabled?: boolean;
};

// The one cream action on a screen. Gives a light haptic tap.
export function PrimaryButton({ label, onPress, accessibilityHint, disabled = false }: Props) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[styles.button, disabled && styles.disabled]}
      onPress={() => {
        tap();
        onPress?.();
      }}
    >
      <Txt variant="button" color="primaryButtonText" maxFontSizeMultiplier={1.3} numberOfLines={1}>
        {label}
      </Txt>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: size.button,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
  },
  disabled: {
    opacity: 0.35,
  },
});
