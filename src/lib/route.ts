import { isPlace, type LatLng } from './geo';

// Walking routes from openrouteservice (SPEC section 3), with the key the owner pastes
// in Settings. Its free plan allows 2,000 routes a day and 40 a minute for each key.
// What is sent: the two points, where you are and where the venue is. Nothing else.

const DIRECTIONS = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
const TIMEOUT_MS = 12_000;

export type RouteStep = {
  /** "Turn left onto Main Street", as openrouteservice words it. */
  instruction: string;
  /** Metres and seconds of walking in this step. */
  distance: number;
  duration: number;
  /** Where on the line the step begins: an index into `WalkingRoute.line`. */
  start: number;
};

export type WalkingRoute = {
  from: LatLng;
  to: LatLng;
  /** The path to walk, from `from` to `to`. */
  line: LatLng[];
  /** Metres. */
  distance: number;
  /** Seconds, at openrouteservice's ordinary walking pace. */
  duration: number;
  /** Each turn, for AR Walk. */
  steps: RouteStep[];
  fetchedAt: number;
};

/** Why a straight line is shown instead of a route. */
export type RouteProblem =
  | 'noKey' // no key in Settings
  | 'offline' // no connection, or openrouteservice did not answer in time
  | 'badKey' // openrouteservice did not accept the key
  | 'quota' // the key's daily or per-minute limit is used up
  | 'noRoute' // no walking route between the two points
  | 'tooFar' // too far to walk, so not asked
  | 'failed'; // anything else

export class RouteError extends Error {
  constructor(readonly problem: RouteProblem) {
    super(problem);
  }
}

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * Reads openrouteservice's answer. The answer is outside data, so every field is
 * checked: anything not shaped like a route is `noRoute`, never a crash.
 */
export function parseRoute(body: unknown, from: LatLng, to: LatLng, now: number): WalkingRoute {
  const feature = (body as { features?: unknown[] } | null)?.features?.[0] as
    | { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> }
    | undefined;
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates)) throw new RouteError('noRoute');
  const line = coordinates
    .map((pair) => (Array.isArray(pair) ? { lat: pair[1], lng: pair[0] } : null))
    .filter(isPlace);
  if (line.length < 2 || line.length !== coordinates.length) throw new RouteError('noRoute');

  const summary = (feature?.properties?.summary ?? {}) as Record<string, unknown>;
  // A route of no length comes back with an empty summary.
  const distance = num(summary.distance) ?? 0;
  const duration = num(summary.duration) ?? 0;

  const segments = Array.isArray(feature?.properties?.segments) ? feature.properties.segments : [];
  const steps: RouteStep[] = [];
  for (const segment of segments as { steps?: unknown }[]) {
    if (!Array.isArray(segment?.steps)) continue;
    for (const step of segment.steps as Record<string, unknown>[]) {
      const start = Array.isArray(step?.way_points) ? num(step.way_points[0]) : null;
      if (start === null || start < 0 || start >= line.length) continue;
      steps.push({
        instruction: typeof step.instruction === 'string' ? step.instruction.slice(0, 200) : '',
        distance: num(step.distance) ?? 0,
        duration: num(step.duration) ?? 0,
        start: Math.floor(start),
      });
    }
  }
  return { from, to, line, distance, duration, steps, fetchedAt: now };
}

/** What an answer that is not a route means. */
export function problemFor(status: number, body: unknown): RouteProblem {
  if (status === 401 || status === 403) return 'badKey';
  if (status === 429) return 'quota';
  const code = num((body as { error?: { code?: unknown } } | null)?.error?.code);
  // 2004: past the longest route allowed. 2009, 2010: no route, or a point too far
  // from any path to start or end on.
  if (code === 2004) return 'tooFar';
  if (status === 404 || code === 2009 || code === 2010) return 'noRoute';
  return 'failed';
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Asks openrouteservice for a walking route. Throws a `RouteError` when there is none. */
export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  key: string,
  { fetcher = fetch as Fetch, now = Date.now() } = {},
): Promise<WalkingRoute> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let response: Response;
  let body: unknown;
  try {
    response = await fetcher(DIRECTIONS, {
      method: 'POST',
      headers: {
        Authorization: key,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json, application/json',
      },
      body: JSON.stringify({
        coordinates: [
          [from.lng, from.lat],
          [to.lng, to.lat],
        ],
        instructions: true,
        language: 'en',
        units: 'm',
      }),
      signal: abort.signal,
    });
    body = await response.json().catch(() => null);
  } catch {
    // No connection, or no answer in time.
    throw new RouteError('offline');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new RouteError(problemFor(response.status, body));
  return parseRoute(body, from, to, now);
}

/**
 * Whether a key looks like one, before anything is sent: openrouteservice keys are
 * long runs of letters, digits and a few marks, with nothing that could break a header.
 */
export const looksLikeKey = (key: string) => /^[A-Za-z0-9+/=_.-]{20,2000}$/.test(key);

/**
 * Tries a key with one short route between two fixed points in Heidelberg, where
 * openrouteservice is made, so nothing about the owner is sent. Says whether it
 * worked, and if not, why.
 */
export async function checkKey(key: string, fetcher?: Fetch): Promise<'ok' | RouteProblem> {
  try {
    await fetchRoute({ lat: 49.41461, lng: 8.681495 }, { lat: 49.41943, lng: 8.686507 }, key, { fetcher });
    return 'ok';
  } catch (error) {
    return error instanceof RouteError ? error.problem : 'failed';
  }
}
