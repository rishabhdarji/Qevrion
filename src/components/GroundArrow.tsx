import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '@/theme';

type Props = {
  /** Width and height of its box, in points. */
  size: number;
  /** Degrees to turn, clockwise from straight ahead. */
  rotation: SharedValue<number>;
  /** How far to lay it down, 0 seen from above to about 70 seen along the ground. */
  lean: SharedValue<number>;
  /** Faded while there is no heading or no position yet. */
  faint?: boolean;
  accessibilityLabel: string;
};

// AR Walk's arrow: a flat 2D dart and a ring, laid down with a perspective transform so
// they read as painted on the ground ahead (SPEC 9: a 2D chevron with perspective
// before any 3D scene). The dart is turned in its own plane first, then the plane is
// tipped back, so it turns like something lying on the pavement.
export function GroundArrow({ size, rotation, lean, faint = false, accessibilityLabel }: Props) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { rotateX: `${lean.get()}deg` },
      { rotateZ: `${rotation.get()}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[{ width: size, height: size }, faint && styles.faint, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <LinearGradient id="dart" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.glow} />
          </LinearGradient>
        </Defs>
        {/* The ring makes the ground plane readable however the dart is turned. */}
        <Circle cx={100} cy={100} r={86} fill="none" stroke={colors.textPrimary} strokeOpacity={0.35} strokeWidth={3} />
        <Path
          d="M100 22 L164 158 L100 126 L36 158 Z"
          fill="url(#dart)"
          stroke={colors.textPrimary}
          strokeOpacity={0.9}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  faint: {
    opacity: 0.35,
  },
});
