import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/theme';

type Props = {
  /** Top and bottom colours, from `covers` in the theme. */
  colors: readonly [string, string];
};

// A drawn cover that fills its parent: a two-colour wash, two faint rings off the
// top-right corner echoing the mark, and a scrim so text at the bottom stays readable.
// Stands in for the event's own image, which arrives in a later round.
export function EventCover({ colors: [from, to] }: Props) {
  // Gradient ids are document-wide on web, so each cover needs its own.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id={`wash${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
        <LinearGradient id={`scrim${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.4" stopColor={colors.background} stopOpacity={0} />
          <Stop offset="1" stopColor={colors.background} stopOpacity={0.72} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#wash${id})`} />
      <Circle cx="100%" cy="0" r="38%" fill="none" stroke={colors.textPrimary} strokeOpacity={0.09} strokeWidth={1.5} />
      <Circle cx="100%" cy="0" r="62%" fill="none" stroke={colors.textPrimary} strokeOpacity={0.06} strokeWidth={1.5} />
      <Rect width="100%" height="100%" fill={`url(#scrim${id})`} />
    </Svg>
  );
}
