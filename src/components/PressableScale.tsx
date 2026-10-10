import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { spring } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
};

// Shared press feedback: settles to 97% and back with no overshoot.
export function PressableScale({ style, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        scale.set(withSpring(0.97, spring));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, spring));
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}
