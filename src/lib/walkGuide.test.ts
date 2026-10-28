import { bearing, distance, nearestPointOnRoute, type LatLng } from './geo';
import type { WalkingRoute } from './route';
import {
  aimFrom,
  ARRIVED_M,
  arrivalAt,
  arrowWords,
  AIM_TOLERANCE_M,
  compassWord,
  formatAccuracy,
  guide,
  pointAlong,
  prepareRoute,
  START,
  turnLabel,
  type GuideState,
} from './walkGuide';

const DEGREE_M = 111_195.08;

/** A point `north` metres north and `east` metres east of `p`. */
const offset = (p: LatLng, north: number, east = 0): LatLng => ({
  lat: p.lat + north / DEGREE_M,
  lng: p.lng + east / (DEGREE_M * Math.cos((p.lat * Math.PI) / 180)),
});

/** How far apart two compass directions are, the short way round. */
const apart = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

// Two blocks in Manhattan: 160 m north, then a right turn and 200 m east.
const start = { lat: 40.7484, lng: -73.9857 };
const corner = offset(start, 160);
const end = offset(corner, 0, 200);
const venue = offset(end, 10);

const twoBlocks: WalkingRoute = {
  from: start,
  to: venue,
  line: [start, corner, end],
  distance: 360,
  duration: 260,
  steps: [
    { instruction: 'Head north on 5th Avenue', distance: 160, duration: 115, start: 0 },
    { instruction: 'Turn right onto West 35th Street', distance: 200, duration: 145, start: 1 },
    { instruction: 'Arrive at West 35th Street, on the left', distance: 0, duration: 0, start: 2 },
  ],
  fetchedAt: 1,
};

const route = prepareRoute(twoBlocks);

describe('prepareRoute', () => {
  it('measures the route and lists its turns, leaving out setting off', () => {
    expect(route.length).toBeCloseTo(360, 0);
    expect(route.along.map(Math.round)).toEqual([0, 160, 360]);
    expect(route.turns.map((t) => [Math.round(t.at), t.instruction])).toEqual([
      [160, 'Turn right onto West 35th Street'],
      [360, 'Arrive at West 35th Street, on the left'],
    ]);
  });

  it('names a turn that came without words, and ignores steps off the line', () => {
    const odd = prepareRoute({
      ...twoBlocks,
      steps: [
        { instruction: '  ', distance: 1, duration: 1, start: 1 },
        { instruction: 'Lost', distance: 1, duration: 1, start: 9 },
      ],
    });
    expect(odd.turns.map((t) => t.instruction)).toEqual(['Turn']);
  });
});

describe('pointAlong', () => {
  it('finds a point part way along, and holds to the ends', () => {
    expect(distance(pointAlong(route, 80), offset(start, 80))).toBeLessThan(0.5);
    expect(distance(pointAlong(route, 260), offset(corner, 0, 100))).toBeLessThan(0.5);
    expect(pointAlong(route, -5)).toEqual(start);
    expect(pointAlong(route, 999)).toEqual(end);
  });
});

/** Walks to `me` from a guidance state, as the screen would. */
const at = (me: LatLng, state: GuideState = START) => guide(route, me, venue, state);

describe('guide', () => {
  it('points up the street to the first turn at the start', () => {
    const g = at(start);
    expect(apart(bearing(start, g.aim), 0)).toBeLessThan(1);
    expect(g.turn?.instruction).toBe('Turn right onto West 35th Street');
    expect(g.toTurn).toBeCloseTo(160, 0);
    expect(g.left).toBeCloseTo(360, 0);
    expect(g.offRoute).toBeCloseTo(0, 0);
    expect(g.arrived).toBe(false);
  });

  it('still points at the turn from a GPS fix a little to one side', () => {
    const me = offset(start, 40, -8);
    expect(apart(bearing(me, at(me).aim), 0)).toBeLessThan(6);
  });

  it('says "now" within 15 m of the turn, and keeps saying it until 15 m past', () => {
    const before = at(offset(corner, -10));
    expect(before.turn?.index).toBe(0);
    expect(turnLabel(before.toTurn!, 'mi')).toBe('Now');
    expect(before.state.next).toBe(1);

    const past = at(offset(corner, 0, 10), before.state);
    expect(past.turn?.index).toBe(0);
    const later = at(offset(corner, 0, 20), past.state);
    expect(later.turn?.instruction).toBe('Arrive at West 35th Street, on the left');
    expect(later.toTurn).toBeCloseTo(180, 0);
  });

  it('swings the arrow into the new street only near the corner', () => {
    // 20 m short of the corner it still aims at the corner...
    const near = offset(corner, -20);
    expect(apart(bearing(near, at(near).aim), 0)).toBeLessThan(2);
    // ...and from 6 m short it aims along the new street, to the right.
    const closer = offset(corner, -6);
    expect(bearing(closer, at(closer).aim)).toBeGreaterThan(75);
  });

  it('points along the new street once round the corner', () => {
    const me = offset(corner, 0, 40);
    expect(apart(bearing(me, at(me, { next: 1 }).aim), 90)).toBeLessThan(1);
  });

  it('does not skip a turn on a fix far off the route', () => {
    const wild = offset(corner, 0, -60);
    const g = at(wild);
    expect(g.offRoute).toBeGreaterThan(40);
    expect(g.state.next).toBe(0);
    expect(g.turn?.index).toBe(0);
  });

  it('never goes back to a turn already reached', () => {
    const g = at(start, { next: 1 });
    expect(g.state.next).toBe(1);
    // The turn behind the state is still ahead of you, so it is the one shown.
    expect(g.turn?.index).toBe(0);
    expect(g.toTurn).toBeCloseTo(160, 0);
  });

  it('says you have arrived within 25 m of the venue, or at the end of the route', () => {
    expect(at(offset(venue, -ARRIVED_M + 2)).arrived).toBe(true);
    expect(at(offset(end, 0, -12), { next: 1 }).arrived).toBe(true);
    expect(at(offset(end, 0, -40), { next: 1 }).arrived).toBe(false);
  });

  it('points straight at the venue with no route', () => {
    const me = offset(venue, -300, -300);
    const g = guide(null, me, venue, START);
    expect(g.aim).toEqual(venue);
    expect(g.turn).toBeNull();
    expect(g.left).toBeCloseTo(distance(me, venue), 3);
    expect(g.offRoute).toBeNull();
  });

  it('walks the whole route, reaching each turn once and arriving at the end', () => {
    let state = START;
    const shown = new Set<string>();
    let arrived = false;
    for (let m = 0; m <= 360; m += 5) {
      const g = at(pointAlong(route, m), state);
      expect(g.state.next).toBeGreaterThanOrEqual(state.next);
      state = g.state;
      if (g.turn) shown.add(g.turn.instruction);
      arrived ||= g.arrived;
    }
    expect([...shown]).toEqual(['Turn right onto West 35th Street', 'Arrive at West 35th Street, on the left']);
    expect(state.next).toBe(2);
    expect(arrived).toBe(true);
  });
});

describe('aimFrom', () => {
  // A path that runs north and then bends gently east along a curve.
  const bend: LatLng[] = [start, offset(start, 100)];
  for (let deg = 10; deg <= 90; deg += 10) {
    const r = (deg * Math.PI) / 180;
    bend.push(offset(offset(start, 100), 80 * Math.sin(r), 80 * (1 - Math.cos(r))));
  }
  const curve = prepareRoute({ ...twoBlocks, line: bend, steps: [], fetchedAt: 2 });

  it('never aims across a bend by more than the tolerance', () => {
    for (const metres of [0, 50, 90, 120, 150]) {
      const on = nearestPointOnRoute(pointAlong(curve, metres), curve.line)!;
      const aim = aimFrom(curve, on);
      const ahead = curve.line.filter((_, i) => curve.along[i] > on.along && curve.along[i] < curve.length);
      const passed = ahead.filter((p) => distance(on.point, p) < distance(on.point, aim));
      for (const p of passed) {
        expect(nearestPointOnRoute(p, [on.point, aim])!.offRoute).toBeLessThanOrEqual(AIM_TOLERANCE_M + 0.5);
      }
      expect(distance(on.point, aim)).toBeGreaterThan(11);
    }
  });
});

describe('turnLabel and arrivalAt', () => {
  it('rounds the way a walker reads it, and never claims more than "about"', () => {
    expect(turnLabel(10, 'mi')).toBe('Now');
    expect(turnLabel(100, 'mi')).toBe('In about 330 ft');
    expect(turnLabel(100, 'km')).toBe('In about 100 m');
  });

  it('adds the walk at an ordinary pace', () => {
    expect(arrivalAt(0, 5000)).toBeCloseTo(3_600_000, -3);
  });
});

describe('words for the screen', () => {
  it('says which way the arrow points', () => {
    expect(arrowWords(5)).toBe('Arrow points straight ahead');
    expect(arrowWords(-40)).toBe('Arrow points ahead and to the left');
    expect(arrowWords(90)).toBe('Arrow points to the right');
    expect(arrowWords(200)).toBe('Arrow points behind you');
  });

  it('gives GPS accuracy as the GPS does, rounded', () => {
    expect(formatAccuracy(8.4, 'km')).toBe('±8 m');
    expect(formatAccuracy(0.2, 'km')).toBe('±1 m');
    expect(formatAccuracy(8, 'mi')).toBe('±25 ft');
    expect(formatAccuracy(1, 'mi')).toBe('±5 ft');
  });

  it('names the compass calibration', () => {
    expect([3, 2, 1, 0, -1].map(compassWord)).toEqual(['good', 'fair', 'poor', 'poor', 'starting']);
  });
});
