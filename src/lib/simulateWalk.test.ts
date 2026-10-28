import { bearing, distance, routeLength, WALKING_M_PER_S, type LatLng } from './geo';
import { signedAngle } from './heading';
import {
  latestAt,
  parseRecording,
  recordFix,
  recordHeading,
  recordingHasRoom,
  recordingToTrack,
  RECORDING_VERSION,
  startRecording,
  walkAlong,
  type Recording,
} from './simulateWalk';

const DEGREE_M = 111_195.08;
const offset = (p: LatLng, north: number, east = 0): LatLng => ({
  lat: p.lat + north / DEGREE_M,
  lng: p.lng + east / (DEGREE_M * Math.cos((p.lat * Math.PI) / 180)),
});

const start = { lat: 40.7484, lng: -73.9857 };
const corner = offset(start, 160);
const line = [start, corner, offset(corner, 0, 200)];

describe('walkAlong', () => {
  const walk = walkAlong(line);

  it('is the same walk every time', () => {
    expect(walkAlong(line)).toEqual(walk);
    expect(walkAlong(line, { seed: 8 })).not.toEqual(walk);
  });

  it('takes as long as the route at an ordinary pace, with a fix every second', () => {
    expect(walk.duration / 1000).toBeCloseTo(routeLength(line) / WALKING_M_PER_S, -1);
    expect(walk.fixes[1].at - walk.fixes[0].at).toBe(1000);
    expect(walk.fixes.at(-1)!.at).toBeLessThanOrEqual(walk.duration);
  });

  it('wanders a few metres from the route, more in the poor stretch, which says so', () => {
    const offRoute = (fix: LatLng) => {
      // Distance to the nearer of the two straight legs.
      const north = Math.abs((fix.lng - start.lng) * DEGREE_M * Math.cos((start.lat * Math.PI) / 180));
      const east = Math.abs((fix.lat - corner.lat) * DEGREE_M);
      return Math.min(north, east);
    };
    const good = walk.fixes.filter((f) => f.accuracy <= 11);
    const poor = walk.fixes.filter((f) => f.accuracy > 30);
    expect(good.length).toBeGreaterThan(poor.length * 5);
    expect(poor.length).toBeGreaterThan(10);
    for (const fix of good) expect(offRoute(fix)).toBeLessThan(25);
    for (const fix of poor) {
      expect(fix.at / walk.duration).toBeGreaterThanOrEqual(0.4);
      expect(fix.at / walk.duration).toBeLessThan(0.5);
    }
  });

  it('starts near the start and ends near the end', () => {
    expect(distance(walk.fixes[0], start)).toBeLessThan(20);
    expect(distance(walk.fixes.at(-1)!, line[2])).toBeLessThan(20);
  });

  it('faces along the street, with a little sway', () => {
    const early = walk.headings.filter((h) => h.at < 60_000);
    for (const h of early) expect(Math.abs(signedAngle(h.heading - bearing(start, corner)))).toBeLessThan(9);
    const late = walk.headings.filter((h) => h.at > walk.duration - 60_000);
    for (const h of late) expect(Math.abs(signedAngle(h.heading - 90))).toBeLessThan(9);
  });
});

describe('latestAt', () => {
  const readings = [{ at: 0 }, { at: 100 }, { at: 200 }, { at: 300 }];

  it('finds the last reading at or before a time', () => {
    expect(latestAt(readings, -1)).toBe(-1);
    expect(latestAt(readings, 0)).toBe(0);
    expect(latestAt(readings, 150)).toBe(1);
    expect(latestAt(readings, 300)).toBe(3);
    expect(latestAt(readings, 9999)).toBe(3);
    expect(latestAt([], 50)).toBe(-1);
  });
});

describe('recordings', () => {
  const recording: Recording = {
    version: RECORDING_VERSION,
    startedAt: Date.UTC(2026, 9, 28, 17),
    venue: line[2],
    fixes: [
      [0, start.lat, start.lng, 6],
      [1000, corner.lat, corner.lng, 8],
    ],
    headings: [
      [0, 10, 12, 3, 88],
      [100, null, 14, 2, 87],
      [200, null, null, 0, 87],
    ],
  };

  it('reads back what was written', () => {
    expect(parseRecording(JSON.stringify(recording))).toEqual(recording);
  });

  it('turns away anything that is not a recording', () => {
    expect(parseRecording('not json')).toBeNull();
    expect(parseRecording('null')).toBeNull();
    expect(parseRecording(JSON.stringify({ ...recording, version: 2 }))).toBeNull();
    expect(parseRecording(JSON.stringify({ ...recording, venue: { lat: 'x', lng: 0 } }))).toBeNull();
    expect(parseRecording(JSON.stringify({ ...recording, fixes: [recording.fixes[0]] }))).toBeNull();
  });

  it('drops rows that are not shaped right, and sorts the rest', () => {
    const messy = {
      ...recording,
      fixes: [recording.fixes[1], ['x', 1, 2, 3], [5, 91, 0, 3], recording.fixes[0]],
      headings: [[1, 400, null, 3, 0], recording.headings[0], 'no'],
    };
    const read = parseRecording(JSON.stringify(messy))!;
    expect(read.fixes).toEqual(recording.fixes);
    expect(read.headings).toEqual([recording.headings[0]]);
  });

  it('replays the heading the arrow used, then the compass, then the way walked', () => {
    const track = recordingToTrack(recording);
    expect(track.fixes[1]).toEqual({ at: 1000, lat: corner.lat, lng: corner.lng, accuracy: 8 });
    expect(track.headings.map((h) => h.heading)).toEqual([10, 14]);
    expect(track.duration).toBe(1000);
    const noHeadings = recordingToTrack({ ...recording, headings: [] });
    expect(noHeadings.headings).toHaveLength(1);
    expect(noHeadings.headings[0].heading).toBeCloseTo(0, 0);
  });

  it('has room for two hours of walk', () => {
    expect(recordingHasRoom(2 * 60 * 60_000)).toBe(true);
    expect(recordingHasRoom(2 * 60 * 60_000 + 1)).toBe(false);
  });
});

describe('recording a walk', () => {
  it('keeps fixes and headings compactly, and reads back as a walk to replay', () => {
    const t0 = Date.UTC(2026, 9, 28, 17);
    const walk = startRecording(t0, line[2]);
    recordFix(walk, { at: t0, lat: 40.74840004, lng: -73.98570004, accuracy: 6.04 });
    recordFix(walk, { at: t0 + 1000, ...corner, accuracy: null });
    recordFix(walk, { at: t0 - 5, ...corner, accuracy: 5 });
    recordHeading(walk, { at: t0 + 250, motion: 359.97, compass: 12.34, level: 2, tilt: 84.6 });
    recordHeading(walk, { at: t0 + 500, motion: null, compass: null, level: -1, tilt: null });

    expect(walk.fixes).toEqual([
      [0, 40.7484, -73.9857, 6],
      [1000, Math.round(corner.lat * 1e6) / 1e6, Math.round(corner.lng * 1e6) / 1e6, -1],
    ]);
    expect(walk.headings).toEqual([
      [250, 0, 12.3, 2, 85],
      [500, null, null, -1, -1],
    ]);

    const read = parseRecording(JSON.stringify(walk))!;
    expect(read).toEqual(walk);
    const track = recordingToTrack(read);
    expect(track.fixes).toHaveLength(2);
    expect(track.headings.map((h) => h.heading)).toEqual([0]);
  });

  it('stops adding after two hours', () => {
    const walk = startRecording(0, line[2]);
    recordFix(walk, { at: 2 * 60 * 60_000 + 1, ...start, accuracy: 5 });
    recordHeading(walk, { at: 2 * 60 * 60_000 + 1, motion: 1, compass: 1, level: 3, tilt: 90 });
    expect(walk.fixes).toEqual([]);
    expect(walk.headings).toEqual([]);
  });
});
