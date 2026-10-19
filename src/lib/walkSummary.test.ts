import { formatTime } from './dates';
import type { WalkingRoute } from './route';
import { walkSummary } from './walkSummary';

const me = { lat: 40.7484, lng: -73.9857 };
// About 1.1 km north-east.
const venue = { lat: 40.7564, lng: -73.9772 };
const MINUTE = 60_000;
const startsAt = new Date(2026, 9, 19, 19, 0).getTime();

const route: WalkingRoute = {
  from: me,
  to: venue,
  line: [me, venue],
  distance: 1450,
  duration: 17 * 60,
  steps: [],
  fetchedAt: 0,
};

const value = (summary: ReturnType<typeof walkSummary>, label: string) =>
  summary.stats.find((s) => s.label === label)?.value;

describe('walkSummary with a route', () => {
  const summary = walkSummary({ kind: 'route', route, kept: false }, me, venue, startsAt, startsAt - 3 * 60 * MINUTE, 'mi');

  it('leaves the walk and five minutes to spare before the start', () => {
    expect(value(summary, 'Leave by')).toBe(formatTime(startsAt - 22 * MINUTE));
    expect(value(summary, 'Walking time')).toBe('17 min');
    expect(value(summary, 'Distance')).toBe('0.9 mi');
    expect(value(summary, 'Event starts')).toBe(formatTime(startsAt));
  });

  it('says where it comes from, and does not offer a key', () => {
    expect(summary.note).toMatch(/openrouteservice/);
    expect(summary.offerKey).toBe(false);
  });

  it('says so when the route was saved from before', () => {
    const kept = walkSummary({ kind: 'route', route, kept: true }, me, venue, startsAt, 0, 'km');
    expect(kept.note).toMatch(/saved from an earlier look/);
    expect(value(kept, 'Distance')).toBe('1.4 km');
  });

  it('says Now once it is time to go, and Started once it has', () => {
    expect(value(walkSummary({ kind: 'route', route, kept: false }, me, venue, startsAt, startsAt - 10 * MINUTE, 'mi'), 'Leave by')).toBe('Now');
    expect(value(walkSummary({ kind: 'route', route, kept: false }, me, venue, startsAt, startsAt + MINUTE, 'mi'), 'Leave by')).toBe('Started');
  });
});

describe('walkSummary with a straight line', () => {
  const summary = walkSummary({ kind: 'straight', problem: 'noKey' }, me, venue, startsAt, 0, 'mi');

  it('gives the straight-line distance, the least time it can take, and the direction', () => {
    expect(value(summary, 'Straight line')).toBe('0.7 mi');
    expect(value(summary, 'Walking time')).toBe('14 min+');
    expect(value(summary, 'Direction')).toBe('North-east');
    // 1,142 m at 5 km/h is 13.7 minutes, and 5 to spare: 18.7 minutes before 7:00.
    expect(value(summary, 'Leave by')).toBe(formatTime(startsAt - 19 * MINUTE));
  });

  it('says why it is a straight line, and offers a key only when one would help', () => {
    expect(summary.note).toMatch(/No route key/);
    expect(summary.offerKey).toBe(true);
    const off = walkSummary({ kind: 'straight', problem: 'offline' }, me, venue, startsAt, 0, 'mi');
    expect(off.note).toMatch(/No connection/);
    expect(off.offerKey).toBe(false);
  });
});
