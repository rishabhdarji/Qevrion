import { Image } from 'expo-image';
import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/theme';

type Props = {
  /** Top and bottom colours, from `covers` in the theme. Shown when there is no photo. */
  colors: readonly [string, string];
  /** The event's own photo, if it has one. */
  photo?: string | null;
};

// A cover that fills its parent. With a photo: the photo, cropped to fit, under a fade
// dark enough to keep text readable even on a white picture. Without one: a two-colour
// wash and two faint rings off the top-right corner echoing the mark, under a lighter
// fade for the text at the bottom.
export function EventCover({ colors: [from, to], photo }: Props) {
  // Gradient ids are document-wide on web, so each cover needs its own.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          // Fades in, so a card does not sit dark and then jump to the picture.
          transition={200}
          // Decorative: the title beside it says what the event is.
          accessible={false}
        />
      ) : null}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={`wash${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
          <LinearGradient id={`scrim${id}`} x1="0" y1="0" x2="0" y2="1">
            {/* Over a photo the top is dimmed too, for the controls and the countdown. */}
            <Stop offset="0" stopColor={colors.background} stopOpacity={photo ? 0.45 : 0} />
            <Stop offset="0.4" stopColor={colors.background} stopOpacity={photo ? 0.55 : 0} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={photo ? 0.94 : 0.72} />
          </LinearGradient>
        </Defs>
        {photo ? null : (
          <>
            <Rect width="100%" height="100%" fill={`url(#wash${id})`} />
            <Circle cx="100%" cy="0" r="38%" fill="none" stroke={colors.textPrimary} strokeOpacity={0.09} strokeWidth={1.5} />
            <Circle cx="100%" cy="0" r="62%" fill="none" stroke={colors.textPrimary} strokeOpacity={0.06} strokeWidth={1.5} />
          </>
        )}
        <Rect width="100%" height="100%" fill={`url(#scrim${id})`} />
      </Svg>
    </>
  );
}
