import { distance } from '../lib/geo';
import type { WalkingRoute } from '../lib/route';
import { deleteAllData, findRoute } from './db';
import { ASK_EVERY_MS, needsNewAnswer, OFF_ROUTE_FOR_MS, walkingRoute, type RouteAnswer } from './routes';

// The real SQL runs here, as in db.test.ts.
jest.mock('expo-sqlite', () => jest.requireActual('./sqlite.testing'));

const me = { lat: 40.7484, lng: -73.9857 };
const venue = { lat: 40.7536, lng: -73.9832 };
const now = new Date(2026, 9, 19, 18).getTime();
const north = (p: { lat: number; lng: number }, metres: number) => ({ ...p, lat: p.lat + metres / 111_195 });

const body = {
  features: [
    {
      geometry: { coordinates: [[me.lng, me.lat], [-73.9846, 40.7499], [venue.lng, venue.lat]] },
      properties: { summary: { distance: 640, duration: 461 }, segments: [] },
    },
  ],
};
const answering = (status = 200, json: unknown = body) =>
  jest.fn(async () => ({ ok: status < 300, status, json: async () => json }) as unknown as Response);
const offline = () =>
  jest.fn(async (): Promise<Response> => {
    throw new TypeError('Network request failed');
  });

beforeEach(deleteAllData);

describe('walkingRoute', () => {
  it('asks once, keeps the route, and uses the kept one next time without asking', async () => {
    const fetcher = answering();
    const first = await walkingRoute(me, venue, { key: 'k', fetcher, now });
    expect(first).toMatchObject({ kind: 'route', kept: false, route: { distance: 640, duration: 461 } });
    expect(findRoute(me, venue, now)).not.toBeNull();

    const again = await walkingRoute(north(me, 30), venue, { key: 'k', fetcher, now: now + 60_000 });
    expect(again).toMatchObject({ kind: 'route', kept: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('gives a straight line with no key, and sends nothing', async () => {
    const fetcher = answering();
    expect(await walkingRoute(me, venue, { key: null, fetcher, now })).toMatchObject({
      kind: 'straight',
      problem: 'noKey',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('gives a straight line with no connection, not an error', async () => {
    expect(await walkingRoute(me, venue, { key: 'k', fetcher: offline(), now })).toMatchObject({
      kind: 'straight',
      problem: 'offline',
    });
  });

  it('does not try at all when the phone says it is offline', async () => {
    const fetcher = answering();
    expect(await walkingRoute(me, venue, { key: 'k', fetcher, now, online: false })).toMatchObject({
      kind: 'straight',
      problem: 'offline',
      online: false,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('still shows a kept route with no connection', async () => {
    await walkingRoute(me, venue, { key: 'k', fetcher: answering(), now });
    expect(await walkingRoute(me, venue, { key: 'k', fetcher: offline(), now: now + 1 })).toMatchObject({
      kind: 'route',
      kept: true,
    });
  });

  it('gives a straight line when there is no route, or the key is refused', async () => {
    const noRoute = answering(404, { error: { code: 2010 } });
    expect(await walkingRoute(me, venue, { key: 'k', fetcher: noRoute, now })).toMatchObject({ problem: 'noRoute' });
    expect(await walkingRoute(me, venue, { key: 'k', fetcher: answering(403, {}), now })).toMatchObject({
      problem: 'badKey',
    });
  });

  it('does not ask for a walk across a country', async () => {
    const fetcher = answering();
    const far = { lat: 34.05, lng: -118.24 };
    expect(await walkingRoute(me, far, { key: 'k', fetcher, now })).toMatchObject({ problem: 'tooFar' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('needsNewAnswer', () => {
  const line = [me, { lat: 40.751, lng: -73.9846 }, venue];
  const route = (fetchedAt = now): RouteAnswer => ({
    kind: 'route',
    kept: false,
    route: { from: me, to: venue, line, distance: 640, duration: 461, steps: [], fetchedAt } as WalkingRoute,
  });
  const straight = (
    problem: Extract<RouteAnswer, { kind: 'straight' }>['problem'],
    at = now,
    online = true,
  ): RouteAnswer => ({
    kind: 'straight',
    problem,
    from: me,
    to: venue,
    at,
    online,
  });

  it('asks when there is no answer yet, or the venue has changed', () => {
    expect(needsNewAnswer(null, me, venue, now)).toBe(true);
    expect(needsNewAnswer(route(), me, north(venue, 200), now)).toBe(true);
  });

  it('keeps a route while you are on it', () => {
    const halfway = { lat: (me.lat + line[1].lat) / 2, lng: (me.lng + line[1].lng) / 2 };
    expect(needsNewAnswer(route(), halfway, venue, now + 10 * ASK_EVERY_MS)).toBe(false);
    expect(needsNewAnswer(route(), north(halfway, 20), venue, now + 10 * ASK_EVERY_MS)).toBe(false);
  });

  it('asks again once you are well off it, but not more than every 30 seconds', () => {
    const off = { lat: me.lat, lng: me.lng - 0.002 };
    expect(distance(off, me)).toBeGreaterThan(40);
    expect(needsNewAnswer(route(), off, venue, now + 1000)).toBe(false);
    expect(needsNewAnswer(route(), off, venue, now + ASK_EVERY_MS)).toBe(true);
  });

  it('waits until you have been off it for 10 seconds', () => {
    const off = { lat: me.lat, lng: me.lng - 0.002 };
    const later = now + 10 * ASK_EVERY_MS;
    expect(needsNewAnswer(route(), off, venue, later, true, later)).toBe(false);
    expect(needsNewAnswer(route(), off, venue, later, true, later - OFF_ROUTE_FOR_MS + 1)).toBe(false);
    expect(needsNewAnswer(route(), off, venue, later, true, later - OFF_ROUTE_FOR_MS)).toBe(true);
  });

  it('tries again after a passing problem, after the wait', () => {
    expect(needsNewAnswer(straight('offline'), me, venue, now + 1000)).toBe(false);
    expect(needsNewAnswer(straight('offline'), me, venue, now + ASK_EVERY_MS)).toBe(true);
    expect(needsNewAnswer(straight('quota'), me, venue, now + ASK_EVERY_MS)).toBe(true);
  });

  it('waits while the phone is offline, and asks the moment it is back', () => {
    const offline = straight('offline', now, false);
    expect(needsNewAnswer(offline, me, venue, now + 99 * ASK_EVERY_MS, false)).toBe(false);
    expect(needsNewAnswer(offline, me, venue, now + 1000, true)).toBe(true);
  });

  it('does not keep asking when the answer would be the same', () => {
    expect(needsNewAnswer(straight('noKey'), north(me, 50), venue, now + 99 * ASK_EVERY_MS)).toBe(false);
    expect(needsNewAnswer(straight('badKey'), me, venue, now + 99 * ASK_EVERY_MS)).toBe(false);
    // Somewhere quite different might have a route.
    expect(needsNewAnswer(straight('noRoute'), north(me, 400), venue, now)).toBe(true);
  });
});
