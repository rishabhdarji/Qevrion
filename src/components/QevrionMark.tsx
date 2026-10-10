import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';

type Props = {
  size?: number;
  color?: string;
};

// The Qevrion mark: an open ring with a diagonal tail through the gap, a "Q" and a
// compass needle at once. Same geometry as assets/mark.svg.
export function QevrionMark({ size = 96, color = colors.textPrimary }: Props) {
  // Optical sizing. Small, the standard tail reads as a magnifying glass, so it is
  // drawn from the ring's centre (a needle) with a slightly heavier stroke.
  const small = size < 32;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      accessibilityRole="image"
      accessibilityLabel="Qevrion"
    >
      <Path d="M55.34 68.5A27 27 0 1 1 68.5 55.34" stroke={color} strokeWidth={small ? 8 : 7} />
      <Path
        d={small ? 'M44 44L84 84' : 'M53 53L84 84'}
        stroke={color}
        strokeWidth={small ? 8 : 7}
        strokeLinecap="round"
      />
    </Svg>
  );
}
