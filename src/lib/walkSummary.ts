import { formatTime } from './dates';
import {
  bearing,
  compassPoint,
  distance,
  formatDistance,
  formatDuration,
  WALKING_M_PER_S,
  type LatLng,
} from './geo';
import type { RouteProblem, WalkingRoute } from './route';

// The numbers and the line of text on Navigate, worked out from the route or, without
// one, from the straight line. Pure, so every case is tested without a phone.

/** Time to spare on arrival, taken off "leave by" (the same five minutes as Round 1). */
export const SPARE_MS = 5 * 60_000;

export type WalkInput =
  | { kind: 'route'; route: WalkingRoute; kept: boolean }
  | { kind: 'straight'; problem: RouteProblem };

export type WalkSummary = {
  stats: { label: string; value: string }[];
  /** Says where the numbers come from, and for a straight line, why. */
  note: string;
  /** For VoiceOver, about the map. */
  mapLabel: string;
  /** Offers the route key screen, when adding or fixing a key would help. */
  offerKey: boolean;
};

const WHY: Record<RouteProblem, string> = {
  noKey: 'No route key is set, so this is a straight line, not a walking route.',
  offline: 'No connection right now, so this is a straight line. The route comes back once you are online.',
  badKey: 'openrouteservice did not accept the route key, so this is a straight line.',
  quota: 'The route key has used up its routes for now, so this is a straight line. Its 2,000 a day start again tomorrow.',
  noRoute: 'openrouteservice found no walking route here, so this is a straight line.',
  tooFar: 'Too far to walk, so this is a straight line.',
  failed: 'The route could not be worked out, so this is a straight line.',
};

function leaveBy(startsAt: number, walkMs: number, now: number): string {
  if (now >= startsAt) return 'Started';
  const at = startsAt - walkMs - SPARE_MS;
  return at <= now ? 'Now' : formatTime(at);
}

export function walkSummary(
  input: WalkInput,
  me: LatLng,
  venue: LatLng,
  startsAt: number,
  now: number,
  units: 'mi' | 'km',
): WalkSummary {
  if (input.kind === 'route') {
    const { route, kept } = input;
    const length = formatDistance(route.distance, units);
    return {
      stats: [
        // "Leave by" first: it is the one number to act on.
        { label: 'Leave by', value: leaveBy(startsAt, route.duration * 1000, now) },
        { label: 'Walking time', value: formatDuration(route.duration) },
        { label: 'Distance', value: length },
        { label: 'Event starts', value: formatTime(startsAt) },
      ],
      note: `Walking route by openrouteservice, from OpenStreetMap data${kept ? ', saved from an earlier look' : ''}. Leave by keeps 5 minutes to spare.`,
      mapLabel: `Map of the walking route from where you are to the venue, ${length}`,
      offerKey: false,
    };
  }
  const straight = distance(me, venue);
  // No walk is shorter than the straight line, so this is the least it can take.
  const walkS = straight / WALKING_M_PER_S;
  const length = formatDistance(straight, units);
  const direction = compassPoint(bearing(me, venue));
  return {
    stats: [
      { label: 'Leave by', value: leaveBy(startsAt, walkS * 1000, now) },
      { label: 'Walking time', value: `${formatDuration(walkS)}+` },
      { label: 'Straight line', value: length },
      { label: 'Direction', value: direction },
    ],
    note: `${WHY[input.problem]} A real walk is longer, so allow more time than this.`,
    mapLabel: `Map with a straight line from where you are to the venue, ${length} to the ${direction.toLowerCase()}`,
    offerKey: input.problem === 'noKey' || input.problem === 'badKey',
  };
}
