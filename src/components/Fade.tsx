import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/theme';

type Props = {
  /** The screen edge the content dissolves into. */
  edge: 'top' | 'bottom';
  height: number;
};

// Lets scrolling content dissolve into the background at an edge instead of being
// cut off by the status bar, the tab bar or a pinned button.
export function Fade({ edge, height }: Props) {
  const top = edge === 'top';
  return (
    <Svg
      style={[styles.fade, top ? styles.top : styles.bottom]}
      width="100%"
      height={height}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id={`fade-${edge}`} x1="0" y1={top ? 0 : 1} x2="0" y2={top ? 1 : 0}>
          <Stop offset="0.35" stopColor={colors.background} stopOpacity={1} />
          <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#fade-${edge})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
});
