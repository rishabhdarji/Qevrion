import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';

type Props = {
  size?: number;
  color?: string;
};

// The Qevrion mark: an open ring with a diagonal tail through the gap, a "Q" and a
// compass needle at once. Same geometry as assets/mark.svg.
export function QevrionMark({ size = 96, color = colors.textPrimary }: Props) {
  // A slightly heavier stroke keeps the gap readable at small sizes.
  const strokeWidth = size < 24 ? 8 : 7;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      accessibilityRole="image"
      accessibilityLabel="Qevrion"
    >
      <Path d="M55.34 68.5A27 27 0 1 1 68.5 55.34" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M53 53L84 84" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}
