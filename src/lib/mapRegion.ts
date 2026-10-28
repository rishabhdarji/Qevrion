import type { LatLng } from './geo';

/** At least this much of the map is shown, about 450 m across, so one point is not a blur. */
const MIN_DELTA = 0.004;
/** Room around the points, so the dots sit inside the card's rounded corners. */
const MARGIN = 1.6;

/** The part of the map that shows every point with room around them. */
export function mapRegion(points: LatLng[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [south, north] = [Math.min(...lats), Math.max(...lats)];
  const [west, east] = [Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    latitudeDelta: Math.max((north - south) * MARGIN, MIN_DELTA),
    longitudeDelta: Math.max((east - west) * MARGIN, MIN_DELTA),
  };
}

/**
 * The points laid out in a box `width` by `height`, north up, for a drawn map: x and y
 * from the top left, the same scale both ways, centred.
 */
export function project(points: LatLng[], width: number, height: number, pad: number) {
  const region = mapRegion(points);
  // A degree of longitude is shorter than one of latitude away from the equator.
  const k = Math.cos((region.latitude * Math.PI) / 180);
  const spanX = region.longitudeDelta * k;
  const spanY = region.latitudeDelta;
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  return points.map((p) => ({
    x: width / 2 + (p.lng - region.longitude) * k * scale,
    y: height / 2 - (p.lat - region.latitude) * scale,
  }));
}
