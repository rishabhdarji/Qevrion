import {
  distance,
  formatDistance,
  nearestPointOnRoute,
  OFF_ROUTE_M,
  WALKING_M_PER_S,
  WAYPOINT_REACHED_M,
  type LatLng,
  type RoutePoint,
} from './geo';
import { signedAngle } from './heading';
import type { WalkingRoute } from './route';

// What AR Walk shows as you walk: where the arrow aims, the next turn and how far it
// is, what is left, and whether you have arrived (SPEC F6 and section 9). Pure, so a
// whole walk is tested without a phone. Distances are in metres.

/** Within this of the venue you have arrived (SPEC F6: about 25 m). */
export const ARRIVED_M = 25;
/** A turn this close ahead gets a haptic tap. */
export const TURN_SOON_M = 30;
/**
 * How far the route may bend away from a straight line to a point before the arrow
 * stops aiming past it. On a straight street the arrow aims at the next turn; on a
 * bending one, at the furthest point it can aim at without cutting through the bend.
 */
export const AIM_TOLERANCE_M = 8;
/** The arrow aims at least this far ahead along the route, so it does not swing about. */
export const AIM_MIN_M = 12;
/** And never further ahead than this. */
const AIM_MAX_M = 400;

export type Turn = {
  /** Metres along the route to the turn. */
  at: number;
  point: LatLng;
  /** As openrouteservice words it: "Turn left onto Alder Row". */
  instruction: string;
};

export type PreparedRoute = {
  line: LatLng[];
  /** Metres along the route to each point of the line. */
  along: number[];
  length: number;
  /** Every turn after setting off. The last is usually the arrival. */
  turns: Turn[];
  /** When the route was fetched, which tells one route from the next. */
  fetchedAt: number;
};

/** A walking route made ready to follow: distances along it, and its turns. */
export function prepareRoute(route: WalkingRoute): PreparedRoute {
  const along = [0];
  for (let i = 1; i < route.line.length; i++) {
    along.push(along[i - 1] + distance(route.line[i - 1], route.line[i]));
  }
  const turns = route.steps
    // The first step is setting off, at the start; it is not a turn to walk to.
    .filter((step) => step.start > 0 && step.start < route.line.length)
    .map((step) => ({
      at: along[step.start],
      point: route.line[step.start],
      instruction: step.instruction.trim() || 'Turn',
    }))
    .sort((a, b) => a.at - b.at);
  return { line: route.line, along, length: along[along.length - 1] ?? 0, turns, fetchedAt: route.fetchedAt };
}

/** The point `metres` along a route, held to its two ends. */
export function pointAlong(route: PreparedRoute, metres: number): LatLng {
  const { line, along } = route;
  if (metres <= 0) return line[0];
  for (let i = 1; i < line.length; i++) {
    if (along[i] >= metres) {
      const span = along[i] - along[i - 1];
      const t = span === 0 ? 0 : (metres - along[i - 1]) / span;
      return {
        lat: line[i - 1].lat + t * (line[i].lat - line[i - 1].lat),
        lng: line[i - 1].lng + t * (line[i].lng - line[i - 1].lng),
      };
    }
  }
  return line[line.length - 1];
}

/** How far `p` is from the straight line between `a` and `b`. */
const offChord = (p: LatLng, a: LatLng, b: LatLng) => nearestPointOnRoute(p, [a, b])?.offRoute ?? 0;

/**
 * Where the arrow aims from a point on the route: the furthest point of the line ahead
 * that can be reached in a straight line without leaving the route by more than
 * `AIM_TOLERANCE_M`, but at least `AIM_MIN_M` ahead. On a straight street that is the
 * next turn; at the corner itself it swings into the new street.
 */
export function aimFrom(route: PreparedRoute, on: RoutePoint): LatLng {
  const { line, along } = route;
  let aim = on.along;
  for (let j = on.segment + 1; j < line.length && along[j] - on.along <= AIM_MAX_M; j++) {
    let straight = true;
    for (let k = on.segment + 1; k < j && straight; k++) {
      straight = offChord(line[k], on.point, line[j]) <= AIM_TOLERANCE_M;
    }
    if (!straight) break;
    aim = along[j];
  }
  return pointAlong(route, Math.max(aim, on.along + AIM_MIN_M));
}

export type GuideState = {
  /** Index into the route's turns of the next turn not yet reached. Never goes back. */
  next: number;
};

export const START: GuideState = { next: 0 };

export type Guidance = {
  /** Where the arrow points. */
  aim: LatLng;
  /** The turn to show: one just reached, or else the next one. Null with no route or no turns. */
  turn: (Turn & { index: number }) | null;
  /** Metres along the route to that turn: 15 or less is "now", and less than 0 is behind you. */
  toTurn: number | null;
  /** Metres still to walk. */
  left: number;
  /** How far you are from the route line. Null without a route. */
  offRoute: number | null;
  arrived: boolean;
  state: GuideState;
};

/**
 * Guidance from where you are. With no route the arrow points straight at the venue.
 * A turn counts as reached within 15 m (SPEC 9), but only while you are on the route,
 * so a wild GPS fix cannot skip turns; and it stays on screen until you are 15 m past
 * it, so "Turn left" is still showing at the corner.
 */
export function guide(
  route: PreparedRoute | null,
  me: LatLng,
  venue: LatLng,
  state: GuideState,
): Guidance {
  const toVenue = distance(me, venue);
  const on = route && route.line.length >= 2 ? nearestPointOnRoute(me, route.line) : null;
  if (!route || !on) {
    return { aim: venue, turn: null, toTurn: null, left: toVenue, offRoute: null, arrived: toVenue <= ARRIVED_M, state };
  }

  let next = state.next;
  if (on.offRoute <= OFF_ROUTE_M) {
    while (next < route.turns.length && on.along >= route.turns[next].at - WAYPOINT_REACHED_M) next++;
  }
  const reached = next > 0 ? route.turns[next - 1] : null;
  const index = reached && on.along - reached.at < WAYPOINT_REACHED_M ? next - 1 : next;
  const turn = index < route.turns.length ? { ...route.turns[index], index } : null;
  const end = route.line[route.line.length - 1];

  return {
    aim: aimFrom(route, on),
    turn,
    toTurn: turn ? turn.at - on.along : null,
    left: Math.max(0, route.length - on.along),
    offRoute: on.offRoute,
    // The route ends where the paths come nearest the venue, which may be a little
    // way from the point the address was found at.
    arrived: toVenue <= ARRIVED_M || distance(me, end) <= WAYPOINT_REACHED_M,
    state: { next },
  };
}

/** "Now" at the turn, otherwise "In about 120 ft": never more exact than GPS is. */
export function turnLabel(toTurn: number, units: 'mi' | 'km'): string {
  return toTurn <= WAYPOINT_REACHED_M ? 'Now' : `In about ${formatDistance(toTurn, units)}`;
}

/** When you would arrive, walking the rest at an ordinary pace. */
export const arrivalAt = (now: number, left: number) => now + (left / WALKING_M_PER_S) * 1000;

/** GPS accuracy worse than this gets the low accuracy banner (SPEC F6: about 30 m). */
export const POOR_GPS_M = 30;

/** The arrow's direction in words, for VoiceOver. */
export function arrowWords(rotation: number): string {
  const turn = signedAngle(rotation);
  const side = turn > 0 ? 'right' : 'left';
  const size = Math.abs(turn);
  if (size < 15) return 'Arrow points straight ahead';
  if (size < 60) return `Arrow points ahead and to the ${side}`;
  if (size < 135) return `Arrow points to the ${side}`;
  return 'Arrow points behind you';
}

/** How sure the GPS is, the way it says it: "±8 m", or "±25 ft" in steps of 5. */
export function formatAccuracy(metres: number, units: 'mi' | 'km'): string {
  if (units === 'km') return `±${Math.max(1, Math.round(metres))} m`;
  return `±${Math.max(5, Math.round(metres / 0.3048 / 5) * 5)} ft`;
}

/** The compass's calibration level in a word. */
export const compassWord = (level: number) =>
  level >= 3 ? 'good' : level === 2 ? 'fair' : level >= 0 ? 'poor' : 'starting';
