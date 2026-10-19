// The maths for Navigate and AR Walk (SPEC section 9). Pure, so it is tested without a
// phone. Distances are in metres, angles in degrees clockwise from north.

export type LatLng = { lat: number; lng: number };

/** The Earth's mean radius, the one the haversine formula is usually given with. */
const EARTH_M = 6_371_008.8;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (rad: number) => (rad * 180) / Math.PI;

/** An angle turned into 0 up to (not including) 360. */
export const normalize = (degrees: number) => ((degrees % 360) + 360) % 360;

/** The distance along the ground between two points, by the haversine formula. */
export function distance(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  // min(): rounding can push h a hair past 1 for points on opposite sides of the Earth.
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The compass direction to set off in from `a` to reach `b`, 0 to 360. */
export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = rad(a.lat);
  const φ2 = rad(b.lat);
  const dLng = rad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng);
  return normalize(deg(Math.atan2(y, x)));
}

/** "North-east" and so on: the nearest of the eight compass points. */
export function compassPoint(degrees: number): string {
  const points = ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'];
  return points[Math.round(normalize(degrees) / 45) % 8];
}

/**
 * How far to turn the arrow: the bearing to the next waypoint less the way the phone
 * faces, as -180 to 180, so a negative turn is to the left.
 */
export function arrowRotation(bearingTo: number, heading: number): number {
  const turn = normalize(bearingTo - heading);
  return turn > 180 ? turn - 360 : turn;
}

export type RoutePoint = {
  /** The closest point on the route line. */
  point: LatLng;
  /** How far `from` is from the line. */
  offRoute: number;
  /** The segment it lies on: between `route[segment]` and `route[segment + 1]`. */
  segment: number;
  /** How far along the route the point is, from its start. */
  along: number;
};

/**
 * The point on a route line nearest to `from`. Each segment is treated as flat, which
 * over the few hundred metres between turns is out by well under a metre.
 * Returns null for a route with no points.
 */
export function nearestPointOnRoute(from: LatLng, route: LatLng[]): RoutePoint | null {
  if (route.length === 0) return null;
  if (route.length === 1) {
    return { point: route[0], offRoute: distance(from, route[0]), segment: 0, along: 0 };
  }
  // Metres east and north of `from`, on a plane laid flat at its latitude.
  const k = Math.cos(rad(from.lat));
  const flat = (p: LatLng) => ({ x: rad(p.lng - from.lng) * k * EARTH_M, y: rad(p.lat - from.lat) * EARTH_M });

  let best: RoutePoint | null = null;
  let walked = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = flat(route[i]);
    const b = flat(route[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    // How far along the segment, 0 to 1. A repeated point is a segment of no length.
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / length2));
    const point = {
      lat: route[i].lat + t * (route[i + 1].lat - route[i].lat),
      lng: route[i].lng + t * (route[i + 1].lng - route[i].lng),
    };
    const offRoute = distance(from, point);
    const segmentLength = distance(route[i], route[i + 1]);
    if (!best || offRoute < best.offRoute) {
      best = { point, offRoute, segment: i, along: walked + t * segmentLength };
    }
    walked += segmentLength;
  }
  return best;
}

/** The length of a route line. */
export function routeLength(route: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += distance(route[i - 1], route[i]);
  return total;
}

/** Within this of a waypoint, it counts as reached (SPEC 9: about 15 m). */
export const WAYPOINT_REACHED_M = 15;

/**
 * Which waypoint to head for next. Moves on from `current` once `from` is within
 * `reached` metres of it, and past any later ones that are just as close, so a run of
 * points bunched at one corner is passed in one go. It never goes back, and it stops
 * at the last waypoint, the venue.
 */
export function advanceWaypoint(
  from: LatLng,
  waypoints: LatLng[],
  current: number,
  reached = WAYPOINT_REACHED_M,
): number {
  const last = waypoints.length - 1;
  let next = Math.max(0, Math.min(current, last));
  while (next < last && distance(from, waypoints[next]) <= reached) next++;
  return next;
}

/** An ordinary walking pace, 5 km/h: what openrouteservice assumes for walking. */
export const WALKING_M_PER_S = 5000 / 3600;

/** Minutes to walk a distance at an ordinary pace, rounded up, at least 1. */
export const walkingMinutes = (metres: number) => Math.max(1, Math.ceil(metres / WALKING_M_PER_S / 60));

/** Seconds of walking shown as minutes, or hours and minutes from an hour on. */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

const MILE_M = 1609.344;
const FOOT_M = 0.3048;

/**
 * A distance the way a walker reads it. In miles: feet under a tenth of a mile, then
 * tenths. In kilometres: metres under one, rounded to tens, then tenths.
 */
export function formatDistance(metres: number, units: 'mi' | 'km'): string {
  if (units === 'mi') {
    const miles = metres / MILE_M;
    if (miles < 0.1) return `${Math.max(10, Math.round(metres / FOOT_M / 10) * 10)} ft`;
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
  }
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Whether a pair of numbers is a real place on the Earth. */
export const isPlace = <T extends { lat: unknown; lng: unknown }>(
  p: T | null | undefined,
): p is T & LatLng =>
  !!p &&
  typeof p.lat === 'number' &&
  typeof p.lng === 'number' &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lng) <= 180;
