import {
  advanceWaypoint,
  arrowRotation,
  bearing,
  compassPoint,
  distance,
  formatDistance,
  formatDuration,
  isPlace,
  nearestPointOnRoute,
  routeLength,
  walkingMinutes,
  type LatLng,
} from './geo';

const at = (lat: number, lng: number): LatLng => ({ lat, lng });

/** One degree of latitude, on the sphere the formula uses. */
const DEGREE_M = 111_195.08;

/** A point `metres` north and `east` metres east of `p`, near enough for short hops. */
const offset = (p: LatLng, north: number, east = 0): LatLng => ({
  lat: p.lat + north / DEGREE_M,
  lng: p.lng + east / (DEGREE_M * Math.cos((p.lat * Math.PI) / 180)),
});

describe('distance', () => {
  it('is zero from a point to itself', () => {
    expect(distance(at(40.7, -74), at(40.7, -74))).toBe(0);
  });

  it('measures one degree of latitude', () => {
    expect(distance(at(0, 0), at(1, 0))).toBeCloseTo(DEGREE_M, 0);
  });

  it('measures Paris to London as about 344 km', () => {
    expect(distance(at(48.8566, 2.3522), at(51.5074, -0.1278)) / 1000).toBeCloseTo(343.6, 0);
  });

  it('is the same both ways, and across the date line', () => {
    const a = at(-17.7, 179.9);
    const b = at(-17.7, -179.9);
    expect(distance(a, b)).toBeCloseTo(distance(b, a), 6);
    expect(distance(a, b)).toBeLessThan(25_000);
  });

  it('is half the Earth round for opposite points, not a failure', () => {
    expect(distance(at(0, 0), at(0, 180))).toBeCloseTo(Math.PI * 6_371_008.8, -1);
  });

  it('is right for a short city walk', () => {
    const start = at(40.7484, -73.9857);
    expect(distance(start, offset(start, 300, 400))).toBeCloseTo(500, -1);
  });
});

describe('bearing', () => {
  it('points north, east, south and west', () => {
    expect(bearing(at(0, 0), at(1, 0))).toBeCloseTo(0, 6);
    expect(bearing(at(0, 0), at(0, 1))).toBeCloseTo(90, 6);
    expect(bearing(at(0, 0), at(-1, 0))).toBeCloseTo(180, 6);
    expect(bearing(at(0, 0), at(0, -1))).toBeCloseTo(270, 6);
  });

  it('is always 0 up to 360', () => {
    const b = bearing(at(10, 10), at(9, 9));
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
    expect(b).toBeCloseTo(225, 0);
  });

  it('goes the short way across the date line', () => {
    expect(bearing(at(0, 179.9), at(0, -179.9))).toBeCloseTo(90, 3);
  });
});

describe('compassPoint', () => {
  it('names the nearest of the eight points', () => {
    expect(compassPoint(0)).toBe('North');
    expect(compassPoint(22)).toBe('North');
    expect(compassPoint(23)).toBe('North-east');
    expect(compassPoint(180)).toBe('South');
    expect(compassPoint(350)).toBe('North');
    expect(compassPoint(-90)).toBe('West');
  });
});

describe('arrowRotation', () => {
  it('turns by the difference between where to go and where the phone faces', () => {
    expect(arrowRotation(90, 0)).toBe(90);
    expect(arrowRotation(0, 90)).toBe(-90);
  });

  it('always takes the shorter turn', () => {
    expect(arrowRotation(10, 350)).toBe(20);
    expect(arrowRotation(350, 10)).toBe(-20);
    expect(arrowRotation(180, 0)).toBe(180);
  });
});

describe('nearestPointOnRoute', () => {
  const start = at(51.5, -0.12);
  // East 200 m, then north 200 m: an L.
  const corner = offset(start, 0, 200);
  const end = offset(corner, 200);
  const route = [start, corner, end];

  it('finds the foot of the perpendicular on the nearest segment', () => {
    const found = nearestPointOnRoute(offset(start, 30, 100), route)!;
    expect(found.segment).toBe(0);
    expect(found.offRoute).toBeCloseTo(30, 0);
    expect(found.along).toBeCloseTo(100, 0);
    expect(distance(found.point, offset(start, 0, 100))).toBeLessThan(0.5);
  });

  it('picks the second segment when that is closer', () => {
    const found = nearestPointOnRoute(offset(corner, 120, 25), route)!;
    expect(found.segment).toBe(1);
    expect(found.offRoute).toBeCloseTo(25, 0);
    expect(found.along).toBeCloseTo(320, 0);
  });

  it('stops at the ends of the line', () => {
    const before = nearestPointOnRoute(offset(start, 0, -50), route)!;
    expect(before.along).toBe(0);
    expect(before.offRoute).toBeCloseTo(50, 0);
    const after = nearestPointOnRoute(offset(end, 80), route)!;
    expect(after.along).toBeCloseTo(400, 0);
    expect(after.offRoute).toBeCloseTo(80, 0);
  });

  it('copes with a repeated point and with one or no points', () => {
    expect(nearestPointOnRoute(start, [start, start, corner])!.offRoute).toBeCloseTo(0, 6);
    expect(nearestPointOnRoute(offset(start, 10), [start])!.offRoute).toBeCloseTo(10, 0);
    expect(nearestPointOnRoute(start, [])).toBeNull();
  });

  it('measures more than 40 m off the line, which is when a new route is wanted', () => {
    expect(nearestPointOnRoute(offset(start, 45, 100), route)!.offRoute).toBeGreaterThan(40);
  });
});

describe('routeLength', () => {
  it('adds up the segments', () => {
    const a = at(0, 0);
    expect(routeLength([a, offset(a, 100), offset(a, 100, 100)])).toBeCloseTo(200, 0);
    expect(routeLength([a])).toBe(0);
  });
});

describe('advanceWaypoint', () => {
  const a = at(40, -74);
  const waypoints = [a, offset(a, 100), offset(a, 104), offset(a, 200)];

  it('stays on the current waypoint until within 15 m of it', () => {
    expect(advanceWaypoint(offset(a, 70), waypoints, 1)).toBe(1);
    expect(advanceWaypoint(offset(a, 84), waypoints, 1)).toBe(1);
  });

  it('moves on once within 15 m, past any others as close', () => {
    // 10 m short of the second point and 14 m short of the third, which is passed too.
    expect(advanceWaypoint(offset(a, 90), waypoints, 1)).toBe(3);
    expect(advanceWaypoint(offset(a, 99), waypoints, 1, 3)).toBe(2);
  });

  it('never goes back and never runs past the venue', () => {
    expect(advanceWaypoint(a, waypoints, 2)).toBe(2);
    expect(advanceWaypoint(offset(a, 200), waypoints, 3)).toBe(3);
    expect(advanceWaypoint(a, waypoints, 9)).toBe(3);
  });

  it('starts from the first waypoint when the start is already reached', () => {
    expect(advanceWaypoint(a, waypoints, 0)).toBe(1);
  });
});

describe('walking time', () => {
  it('walks 5 km in an hour, and never says less than a minute', () => {
    expect(walkingMinutes(5000)).toBe(60);
    expect(walkingMinutes(1)).toBe(1);
    expect(walkingMinutes(0)).toBe(1);
  });

  it('shows minutes, then hours and minutes', () => {
    expect(formatDuration(20)).toBe('1 min');
    expect(formatDuration(17 * 60 + 10)).toBe('17 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3600 + 25 * 60)).toBe('1 h 25 min');
  });
});

describe('formatDistance', () => {
  it('uses feet for a very short walk and tenths of a mile after', () => {
    expect(formatDistance(50, 'mi')).toBe('160 ft');
    expect(formatDistance(1, 'mi')).toBe('10 ft');
    expect(formatDistance(1287, 'mi')).toBe('0.8 mi');
    expect(formatDistance(40_000, 'mi')).toBe('25 mi');
  });

  it('uses metres under a kilometre and tenths after', () => {
    expect(formatDistance(347, 'km')).toBe('350 m');
    expect(formatDistance(1250, 'km')).toBe('1.3 km');
    expect(formatDistance(23_400, 'km')).toBe('23 km');
  });
});

describe('isPlace', () => {
  it('accepts real places and nothing else', () => {
    expect(isPlace(at(51.5, -0.12))).toBe(true);
    expect(isPlace(at(91, 0))).toBe(false);
    expect(isPlace(at(0, 181))).toBe(false);
    expect(isPlace(at(NaN, 0))).toBe(false);
    expect(isPlace(null)).toBe(false);
  });
});
