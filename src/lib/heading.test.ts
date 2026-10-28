import {
  compassNeedsCalibration,
  declination,
  easeAngle,
  facing,
  filterHeading,
  signedAngle,
  type HeadingFilter,
} from './heading';

const RIGHT = Math.PI / 2;

/** How far apart two headings are, the short way round. */
const apart = (a: number, b: number) => Math.abs(signedAngle(a - b));

describe('signedAngle', () => {
  it('turns any angle into -180 to 180', () => {
    expect(signedAngle(0)).toBe(0);
    expect(signedAngle(190)).toBe(-170);
    expect(signedAngle(-190)).toBe(170);
    expect(signedAngle(720 + 45)).toBe(45);
  });
});

describe('facing', () => {
  // Apple's frame has X to magnetic north and Z up, so with no yaw the phone's top
  // (its y axis) points west.
  it('follows the top of a phone lying flat', () => {
    expect(facing({ alpha: 0, beta: 0, gamma: 0 }).heading).toBeCloseTo(270);
    expect(facing({ alpha: -RIGHT, beta: 0, gamma: 0 }).heading).toBeCloseTo(0);
    expect(facing({ alpha: Math.PI, beta: 0, gamma: 0 }).heading).toBeCloseTo(90);
    expect(facing({ alpha: 0, beta: 0, gamma: 0 }).tilt).toBeCloseTo(0);
  });

  it('follows the back camera of a phone held upright', () => {
    // Tipping the top up turns the camera to where the top was pointing.
    const upright = facing({ alpha: -RIGHT, beta: RIGHT, gamma: 0 });
    expect(upright.heading).toBeCloseTo(0);
    expect(upright.tilt).toBeCloseTo(90);
    expect(facing({ alpha: Math.PI, beta: RIGHT, gamma: 0 }).heading).toBeCloseTo(90);
  });

  it('gives the same answer for the two ways of writing an upright phone', () => {
    // Held upright, yaw and roll turn about the same axis: only their sum matters.
    const a = facing({ alpha: -RIGHT, beta: RIGHT, gamma: 0 }).heading!;
    const b = facing({ alpha: 0, beta: RIGHT, gamma: -RIGHT }).heading!;
    const c = facing({ alpha: -0.3, beta: RIGHT - 1e-6, gamma: -RIGHT + 0.3 }).heading!;
    expect(apart(a, b)).toBeLessThan(0.01);
    expect(apart(a, c)).toBeLessThan(0.01);
  });

  it('does not jump while the phone is tilted from flat to upright', () => {
    let previous = facing({ alpha: -RIGHT, beta: 0, gamma: 0 }).heading!;
    for (let pitch = 0; pitch <= RIGHT; pitch += 0.05) {
      const now = facing({ alpha: -RIGHT, beta: pitch, gamma: 0 });
      expect(apart(now.heading!, previous)).toBeLessThan(0.5);
      expect(apart(now.heading!, 0)).toBeLessThan(0.5);
      previous = now.heading!;
    }
    expect(facing({ alpha: -RIGHT, beta: Math.PI / 4, gamma: 0 }).tilt).toBeCloseTo(45);
  });

  it('turns with the walker, whatever the tilt', () => {
    for (const pitch of [0.2, 0.8, 1.3, RIGHT]) {
      const north = facing({ alpha: -RIGHT, beta: pitch, gamma: 0 }).heading!;
      // Yaw counts anticlockwise from above, so less yaw is a turn to the right.
      const right = facing({ alpha: -RIGHT - 0.5, beta: pitch, gamma: 0 }).heading!;
      expect(signedAngle(right - north)).toBeCloseTo((0.5 * 180) / Math.PI, 0);
    }
  });

  it('has no heading for a phone tipped past upright with its screen to the ground', () => {
    // Top tilted 45 degrees up toward north, screen 45 degrees down toward north.
    expect(facing({ alpha: -RIGHT, beta: Math.PI / 4, gamma: Math.PI }).heading).toBeNull();
  });
});

describe('declination', () => {
  it('is true less magnetic, the short way round', () => {
    expect(declination(10, 355)).toBeCloseTo(15);
    expect(declination(347, 0)).toBeCloseTo(-13);
  });

  it('is zero when the true heading is not known', () => {
    expect(declination(-1, 120)).toBe(0);
  });
});

describe('filterHeading', () => {
  const feed = (readings: number[], everyMs = 50, start: HeadingFilter | null = null) => {
    let filter = start;
    const out: number[] = [];
    readings.forEach((reading, i) => {
      filter = filterHeading(filter, reading, (start?.at ?? 0) + (i + 1) * everyMs);
      out.push(filter.value);
    });
    return { out, filter: filter! };
  };

  it('takes the first reading as it is', () => {
    expect(filterHeading(null, 123, 0).value).toBe(123);
    expect(filterHeading(null, -10, 0).value).toBe(350);
  });

  it('steadies a shaky reading while the phone is held still', () => {
    // Five seconds at 20 readings a second, each up to 6 degrees either way of 90.
    const shaky = Array.from({ length: 100 }, (_, i) => 90 + 6 * Math.sin(i * 2.7));
    const { out } = feed(shaky);
    const settled = out.slice(40);
    const spread = Math.max(...settled) - Math.min(...settled);
    expect(spread).toBeLessThan(3);
    expect(apart(settled[settled.length - 1], 90)).toBeLessThan(1.5);
  });

  it('goes across north the short way', () => {
    const { out } = feed([358, 359, 1, 2, 3, 2, 1, 359, 358]);
    for (const value of out) expect(apart(value, 0)).toBeLessThan(3);
  });

  it('keeps up when the walker turns', () => {
    // A quick quarter turn: 90 degrees in one second.
    const turn = Array.from({ length: 20 }, (_, i) => (i + 1) * 4.5);
    const { out, filter } = feed(turn, 50, { value: 0, speed: 0, at: 0 });
    expect(apart(out[out.length - 1], 90)).toBeLessThan(15);
    // And settles on the new heading soon after.
    const after = feed(Array.from({ length: 20 }, () => 90), 50, filter);
    expect(apart(after.out[after.out.length - 1], 90)).toBeLessThan(2);
  });

  it('starts afresh after a gap, rather than sweeping across it', () => {
    const before = filterHeading(null, 10, 0);
    expect(filterHeading(before, 200, 5000).value).toBe(200);
  });
});

describe('easeAngle', () => {
  it('moves part of the way, the short way round', () => {
    const eased = easeAngle(350, 20, 400, 0.4);
    expect(signedAngle(eased - 350)).toBeGreaterThan(15);
    expect(signedAngle(eased - 350)).toBeLessThan(30);
    expect(easeAngle(350, 20, 60_000, 0.4)).toBeCloseTo(20);
    expect(easeAngle(350, 20, 0, 0.4)).toBeCloseTo(350);
  });
});

describe('compassNeedsCalibration', () => {
  it('asks at 35 degrees or worse', () => {
    expect([0, 1, 2, 3].map(compassNeedsCalibration)).toEqual([true, true, false, false]);
  });
});
