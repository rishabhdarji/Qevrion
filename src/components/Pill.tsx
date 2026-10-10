import { StyleSheet } from 'react-native';

import { colors, fonts, radius, size, space } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

type Props = {
  label: string;
  icon?: IconName;
  /** `light` is the one filled action in a header; `dark` sits beside it. */
  tone?: 'dark' | 'light';
  onPress?: () => void;
  accessibilityLabel?: string;
};

// The compact header action, icon plus label.
export function Pill({ label, icon, tone = 'dark', onPress, accessibilityLabel }: Props) {
  const light = tone === 'light';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={(size.tap - size.pill) / 2}
      style={[styles.pill, light ? styles.light : styles.dark]}
      onPress={onPress}
    >
      {icon ? (
        <Icon name={icon} size={16} color={light ? colors.primaryButtonText : colors.textPrimary} />
      ) : null}
      <Txt
        variant="bodySmall"
        color={light ? 'primaryButtonText' : 'textPrimary'}
        maxFontSizeMultiplier={1.3}
        style={styles.label}
      >
        {label}
      </Txt>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: size.pill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
  },
  dark: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  light: {
    backgroundColor: colors.primaryButton,
  },
  label: {
    fontFamily: fonts.medium,
  },
});
