import { StyleSheet, View } from 'react-native';

import { tick } from '@/lib/haptics';
import { colors, fonts, radius, size, space, type ColorName } from '@/theme';

import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

type Props = {
  label: string;
  selected?: boolean;
  /** A small coloured dot before the label, for example red on "Has conflicts". */
  dot?: ColorName;
  /** Without `onPress` the chip is a plain tag, for example a key detail. */
  onPress?: () => void;
};

export function Chip({ label, selected = false, dot, onPress }: Props) {
  const content = (
    <>
      {dot ? <View style={[styles.dot, { backgroundColor: colors[dot] }]} /> : null}
      <Txt
        variant="bodySmall"
        color={selected ? 'primaryButtonText' : onPress ? 'textSecondary' : 'textPrimary'}
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </Txt>
    </>
  );

  if (!onPress) {
    return <View style={[styles.chip, styles.tag]}>{content}</View>;
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={(size.tap - size.chip) / 2}
      style={[styles.chip, selected ? styles.selected : styles.idle]}
      onPress={() => {
        tick();
        onPress();
      }}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: size.chip,
    borderRadius: radius.inner,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    borderWidth: 1,
  },
  idle: {
    borderColor: colors.hairline,
  },
  tag: {
    backgroundColor: colors.surface,
    borderColor: colors.surface,
  },
  selected: {
    backgroundColor: colors.primaryButton,
    borderColor: colors.primaryButton,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: fonts.medium,
  },
});
