import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { distance, nearestPointOnRoute, type LatLng } from '../lib/geo';
import { fetchRoute, RouteError, type RouteProblem, type WalkingRoute } from '../lib/route';
import * as db from './db';
import { getRouteKey } from './secrets';

// Where Navigate gets its walking route: a kept one if it fits, otherwise one asked
// for with the owner's key, otherwise a straight line with the reason why. Never an
// error on the screen: with no key, no connection or no route, the straight line and
// the two map buttons are still there.

export type RouteAnswer =
  | { kind: 'route'; route: WalkingRoute; kept: boolean }
  | { kind: 'straight'; problem: RouteProblem; from: LatLng; to: LatLng; at: number };

/** Further than this in a straight line is not a walk, and is not asked for. */
export const TOO_FAR_M = 30_000;
/** Further than this from the route line, a new route is wanted (SPEC 9: about 40 m). */
export const OFF_ROUTE_M = 40;
/** At most one new route this often (SPEC 9: one re-route per 30 seconds). */
export const ASK_EVERY_MS = 30_000;
/** A venue that moved further than this is a different venue. */
const SAME_VENUE_M = 25;

/** Works out the route for one walk. Asks openrouteservice only when nothing kept fits. */
export async function walkingRoute(
  from: LatLng,
  to: LatLng,
  { key, fetcher, now = Date.now() }: { key: string | null; fetcher?: typeof fetch; now?: number },
): Promise<RouteAnswer> {
  const straight = (problem: RouteProblem): RouteAnswer => ({ kind: 'straight', problem, from, to, at: now });
  if (distance(from, to) > TOO_FAR_M) return straight('tooFar');
  const kept = db.findRoute(from, to, now);
  if (kept) return { kind: 'route', route: kept, kept: true };
  if (!key) return straight('noKey');
  try {
    const route = await fetchRoute(from, to, key, { fetcher, now });
    db.keepRoute(route);
    return { kind: 'route', route, kept: false };
  } catch (error) {
    return straight(error instanceof RouteError ? error.problem : 'failed');
  }
}

/** Problems that may be gone a little later, so it is worth asking again. */
const PASSING: readonly RouteProblem[] = ['offline', 'quota', 'failed'];

/**
 * Whether the answer on screen still does for where the owner is now. A route does
 * until they are well off it; a straight line given for a passing problem is tried
 * again, but no more often than `ASK_EVERY_MS`.
 */
export function needsNewAnswer(
  answer: RouteAnswer | null,
  me: LatLng,
  venue: LatLng,
  now: number,
): boolean {
  if (!answer) return true;
  const to = answer.kind === 'route' ? answer.route.to : answer.to;
  if (distance(to, venue) > SAME_VENUE_M) return true;
  if (answer.kind === 'route') {
    const off = nearestPointOnRoute(me, answer.route.line)?.offRoute ?? Infinity;
    return off > OFF_ROUTE_M && now - answer.route.fetchedAt >= ASK_EVERY_MS;
  }
  if (answer.problem === 'tooFar') return distance(me, venue) <= TOO_FAR_M;
  if (PASSING.includes(answer.problem)) return now - answer.at >= ASK_EVERY_MS;
  // No key, a key refused, or no route: asking again from a little further on would
  // give the same answer. Coming back to the screen starts afresh.
  return distance(me, answer.from) > OFF_ROUTE_M * 5;
}

/**
 * The walking route from `me` to `venue`, kept up to date as `me` moves. Null while
 * the first answer is on its way, or when either point is not known.
 */
export function useWalkingRoute(me: LatLng | null, venue: LatLng | null): RouteAnswer | null {
  const [answer, setAnswer] = useState<RouteAnswer | null>(null);
  const asking = useRef(false);
  // Bumped when a question is answered, when a passing problem may have passed, and
  // each time the screen comes back to the front (for example after a key was added in
  // Settings), so the answer is checked again.
  const [round, setRound] = useState(0);
  // An answer that comes back after the screen went away, or for a venue no longer
  // shown, is not used. A newer position arriving while waiting does not throw it away.
  const focused = useRef(false);
  const latestVenue = useRef(venue);
  useEffect(() => {
    latestVenue.current = venue;
  }, [venue]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setRound((n) => n + 1);
      return () => {
        focused.current = false;
        setAnswer(null);
      };
    }, []),
  );

  useEffect(() => {
    if (!me || !venue || !focused.current || asking.current) return;
    if (!needsNewAnswer(answer, me, venue, Date.now())) return;
    asking.current = true;
    getRouteKey()
      .then((key) => walkingRoute(me, venue, { key }))
      .then((next) => {
        const to = next.kind === 'route' ? next.route.to : next.to;
        const still = latestVenue.current;
        if (focused.current && still && distance(to, still) <= SAME_VENUE_M) setAnswer(next);
      })
      .catch(() => {})
      .finally(() => {
        asking.current = false;
        if (focused.current) setRound((n) => n + 1);
      });
  }, [me, venue, answer, round]);

  // Standing still with no connection: try again once the wait is over, so turning
  // Wi-Fi back on brings the route without having to move.
  useEffect(() => {
    if (answer?.kind !== 'straight' || !PASSING.includes(answer.problem)) return;
    const timer = setTimeout(() => setRound((n) => n + 1), ASK_EVERY_MS + 500);
    return () => clearTimeout(timer);
  }, [answer]);

  return me && venue ? answer : null;
}
