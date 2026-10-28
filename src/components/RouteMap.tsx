import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import type { LatLng } from '@/lib/geo';
import { mapRegion } from '@/lib/mapRegion';
import { colors } from '@/theme';

export type RouteMapProps = {
  venue: LatLng;
  /** Where the owner is, when known. */
  me?: LatLng | null;
  /** The walking route. Without one, a dashed straight line joins `me` to the venue. */
  line?: LatLng[] | null;
  /** What VoiceOver reads for the whole map. */
  accessibilityLabel: string;
};

function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

const toMap = ({ lat, lng }: LatLng) => ({ latitude: lat, longitude: lng });

// Apple Maps, dark and muted so the blue route is what stands out, framed to show
// both ends. A picture to look at: it does not pan or zoom, so the page scrolls over it.
// The two map buttons below it are for exploring.
export function RouteMap({ venue, me, line, accessibilityLabel }: RouteMapProps) {
  const path = line && line.length > 1 ? line : me ? [me, venue] : null;
  // Worked out again only when the points change, not on every redraw of the screen.
  const region = useMemo(() => mapRegion([venue, ...(me ? [me] : []), ...(line ?? [])]), [venue, me, line]);
  return (
    <View
      style={StyleSheet.absoluteFill}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <MapView
        style={StyleSheet.absoluteFill}
        region={region}
        mapType="mutedStandard"
        userInterfaceStyle="dark"
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        showsBuildings={false}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        // The phone's own blue dot is left off: the green start dot is where you are.
        showsUserLocation={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {path ? (
          <>
            {/* A soft wider line under the route, as in the reference. */}
            <Polyline
              coordinates={path.map(toMap)}
              strokeColor={colors.routeHalo}
              strokeWidth={10}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={path.map(toMap)}
              strokeColor={colors.accent}
              strokeWidth={4}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={line && line.length > 1 ? undefined : [2, 8]}
            />
          </>
        ) : null}
        {me ? (
          <Marker coordinate={toMap(me)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <Dot color={colors.success} />
          </Marker>
        ) : null}
        <Marker coordinate={toMap(venue)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <Dot color={colors.destructive} />
        </Marker>
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: colors.markerRing,
  },
});
