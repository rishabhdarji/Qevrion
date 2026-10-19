import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';

import { project } from '@/lib/mapRegion';
import { colors } from '@/theme';

import type { RouteMapProps } from './RouteMap';

// The desktop preview's stand-in for RouteMap.tsx: Apple Maps cannot run in a
// browser, so the same points are drawn on a plain card. The iPhone never loads this.

const W = 340;
const H = 255;

export function RouteMap({ venue, me, line, accessibilityLabel }: RouteMapProps) {
  const path = line && line.length > 1 ? line : me ? [me, venue] : [];
  const points = project([venue, ...(me ? [me] : []), ...path], W, H, 28);
  const [end, start] = points;
  const drawn = points
    .slice(me ? 2 : 1)
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
  return (
    <View
      style={StyleSheet.absoluteFill}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Rect width={W} height={H} fill={colors.mapLand} />
        {path.length > 1 ? (
          <>
            <Polyline points={drawn} fill="none" stroke={colors.routeHalo} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
            <Polyline
              points={drawn}
              fill="none"
              stroke={colors.accent}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={line && line.length > 1 ? undefined : '2 8'}
            />
          </>
        ) : null}
        {me ? <Circle cx={start.x} cy={start.y} r={7} fill={colors.success} stroke={colors.markerRing} strokeWidth={3} /> : null}
        <Circle cx={end.x} cy={end.y} r={7} fill={colors.destructive} stroke={colors.markerRing} strokeWidth={3} />
      </Svg>
    </View>
  );
}
