import { StyleSheet, View } from 'react-native';

import { colors, space } from '@/theme';

type Props = {
  count: number;
  /** Zero-based. */
  current: number;
};

// Where you are in a short sequence: onboarding pages, import steps.
export function StepBars({ count, current }: Props) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`Step ${current + 1} of ${count}`}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.bar, index === current && styles.active]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space[2] - 2,
  },
  bar: {
    width: space[2],
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.secondaryButtonBorder,
  },
  active: {
    width: space[6],
    backgroundColor: colors.textPrimary,
  },
});
