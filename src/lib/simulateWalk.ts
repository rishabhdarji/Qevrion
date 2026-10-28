import { bearing, distance, normalize, WALKING_M_PER_S, type LatLng } from './geo';

// Walks for the "Simulate AR Walk" developer mode, so AR Walk can be tried at a desk:
// a made-up walk along a route, with GPS-like error, or a real walk recorded on this
// phone. Pure, so both are tested without a phone. Times are milliseconds from the
// start of the walk.

export type Fix = LatLng & {
  at: number;
  /** Metres either way, as the GPS reports it. */
  accuracy: number;
};

export type HeadingReading = {
  at: number;
  /** True heading "ahead", 0 to 360. */
  heading: number;
  /** The compass's calibration level, 0 to 3 (see `compassNeedsCalibration`). */
  level: number;
};

export type Track = {
  fixes: Fix[];
  headings: HeadingReading[];
  /** Milliseconds from the first reading to the last. */
  duration: number;
};

/** A small, repeatable random number source (mulberry32), so a simulated walk is the same every time. */
function randomSource(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One draw from a normal distribution with mean 0 and spread 1. */
const normal = (random: () => number) =>
  Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

const METRES_PER_DEGREE = 111_195;

/** `p` moved `north` and `east` metres. Near enough over a few hundred metres. */
const shift = (p: LatLng, north: number, east: number): LatLng => ({
  lat: p.lat + north / METRES_PER_DEGREE,
  lng: p.lng + east / (METRES_PER_DEGREE * Math.cos((p.lat * Math.PI) / 180)),
});

/** One GPS fix a second, as the phone gives them to a walker. */
const FIX_EVERY_MS = 1000;
/** Ten compass readings a second. */
const HEADING_EVERY_MS = 100;
/** Usual GPS error in a city, metres either way, and how long it takes to wander off. */
const GPS_SPREAD_M = 4;
const GPS_WANDER_S = 10;
/** A stretch of poor GPS between tall buildings, as a share of the walk. */
const POOR_FROM = 0.4;
const POOR_TO = 0.5;
const POOR_SPREAD_M = 14;

/**
 * A made-up walk along `line` at an ordinary pace. The GPS error wanders slowly, as
 * real GPS does, and gets worse for a stretch near the middle (with a reported
 * accuracy worse than 30 m) so the low accuracy banner can be seen. The heading is
 * the way of the street, with the sway of a walking stride.
 */
export function walkAlong(line: LatLng[], { pace = WALKING_M_PER_S, seed = 7 } = {}): Track {
  const random = randomSource(seed);
  const legs = line.slice(1).map((p, i) => distance(line[i], p));
  const length = legs.reduce((sum, leg) => sum + leg, 0);
  const duration = Math.max(FIX_EVERY_MS, Math.ceil((length / pace) * 1000));

  /** Where the walker truly is after `ms`, and which way the street runs there. */
  const truth = (ms: number) => {
    let left = Math.min(length, (ms / 1000) * pace);
    for (let i = 0; i < legs.length; i++) {
      if (left <= legs[i] || i === legs.length - 1) {
        const t = legs[i] === 0 ? 0 : Math.min(1, left / legs[i]);
        return {
          at: {
            lat: line[i].lat + t * (line[i + 1].lat - line[i].lat),
            lng: line[i].lng + t * (line[i + 1].lng - line[i].lng),
          },
          way: bearing(line[i], line[i + 1]),
        };
      }
      left -= legs[i];
    }
    return { at: line[0], way: 0 };
  };

  const fixes: Fix[] = [];
  let north = 0;
  let east = 0;
  for (let ms = 0; ms <= duration; ms += FIX_EVERY_MS) {
    const share = ms / duration;
    const poor = share >= POOR_FROM && share < POOR_TO;
    const spread = poor ? POOR_SPREAD_M : GPS_SPREAD_M;
    // An Ornstein-Uhlenbeck wander: drifts, but is pulled back toward the truth.
    const dt = FIX_EVERY_MS / 1000;
    const pull = dt / GPS_WANDER_S;
    north += -north * pull + spread * Math.sqrt(2 * pull) * normal(random);
    east += -east * pull + spread * Math.sqrt(2 * pull) * normal(random);
    const accuracy = Math.round(poor ? 35 + random() * 12 : 5 + random() * 6);
    fixes.push({ ...shift(truth(ms).at, north, east), at: ms, accuracy });
  }

  const headings: HeadingReading[] = [];
  for (let ms = 0; ms <= duration; ms += HEADING_EVERY_MS) {
    // Two strides a second swing the phone a few degrees each way.
    const sway = 4 * Math.sin((2 * Math.PI * 0.9 * ms) / 1000) + normal(random);
    headings.push({ at: ms, heading: normalize(truth(ms).way + sway), level: 3 });
  }
  return { fixes, headings, duration };
}

/** The index of the last reading at or before `ms`, or -1 when there is none yet. */
export function latestAt(readings: { at: number }[], ms: number): number {
  let low = 0;
  let high = readings.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (readings[middle].at <= ms) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

// A walk recorded on this phone, kept as one small file so it can be replayed at a desk
// and shared for tuning. Rows are arrays, not objects, to keep a long walk small.

export const RECORDING_VERSION = 1;

export type Recording = {
  version: typeof RECORDING_VERSION;
  /** When the walk started, in milliseconds since 1970. */
  startedAt: number;
  venue: LatLng;
  /** [ms, lat, lng, accuracy] */
  fixes: [number, number, number, number][];
  /** [ms, heading from motion or null, heading from the compass or null, compass level, tilt] */
  headings: [number, number | null, number | null, number, number][];
};

/** Hours of walk kept at most, so a walk left running cannot fill the phone. */
const RECORDING_MAX_MS = 2 * 60 * 60_000;

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isHeading = (value: unknown) => value === null || (isNumber(value) && value >= 0 && value < 360);

/**
 * Reads a recording back from its file. The file is checked row by row; anything not
 * shaped like a recording is null, never a crash.
 */
export function parseRecording(text: string): Recording | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const r = value as Partial<Recording> | null;
  if (!r || r.version !== RECORDING_VERSION || !isNumber(r.startedAt)) return null;
  if (!r.venue || !isNumber(r.venue.lat) || !isNumber(r.venue.lng)) return null;
  if (!Array.isArray(r.fixes) || !Array.isArray(r.headings)) return null;
  const fixes = r.fixes.filter(
    (row) =>
      Array.isArray(row) &&
      row.length === 4 &&
      row.every(isNumber) &&
      row[0] >= 0 &&
      row[0] <= RECORDING_MAX_MS &&
      Math.abs(row[1]) <= 90 &&
      Math.abs(row[2]) <= 180,
  );
  const headings = r.headings.filter(
    (row) =>
      Array.isArray(row) &&
      row.length === 5 &&
      isNumber(row[0]) &&
      row[0] >= 0 &&
      row[0] <= RECORDING_MAX_MS &&
      isHeading(row[1]) &&
      isHeading(row[2]) &&
      isNumber(row[3]) &&
      isNumber(row[4]),
  );
  if (fixes.length < 2) return null;
  return {
    version: RECORDING_VERSION,
    startedAt: r.startedAt,
    venue: { lat: r.venue.lat, lng: r.venue.lng },
    fixes: [...fixes].sort((a, b) => a[0] - b[0]),
    headings: [...headings].sort((a, b) => a[0] - b[0]),
  };
}

/**
 * A recording as a walk to replay. The heading replayed is the one the arrow used (from
 * motion), or the compass's where motion had none, or else the way the walker moved.
 */
export function recordingToTrack(recording: Recording): Track {
  const fixes = recording.fixes.map(([at, lat, lng, accuracy]) => ({ at, lat, lng, accuracy }));
  const headings: HeadingReading[] = [];
  for (const [at, motion, compass, level] of recording.headings) {
    const heading = motion ?? compass;
    if (heading !== null) headings.push({ at, heading, level });
  }
  if (headings.length === 0) {
    for (let i = 1; i < fixes.length; i++) {
      headings.push({ at: fixes[i].at, heading: bearing(fixes[i - 1], fixes[i]), level: 3 });
    }
  }
  const last = Math.max(fixes[fixes.length - 1]?.at ?? 0, headings[headings.length - 1]?.at ?? 0);
  return { fixes, headings, duration: last };
}

/** Whether a reading at `ms` from the start may still be added to a recording. */
export const recordingHasRoom = (ms: number) => ms <= RECORDING_MAX_MS;

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

/** A new, empty recording of a walk to `venue`, timed from `at`. */
export const startRecording = (at: number, venue: LatLng): Recording => ({
  version: RECORDING_VERSION,
  startedAt: at,
  venue: { lat: venue.lat, lng: venue.lng },
  fixes: [],
  headings: [],
});

/**
 * Adds a GPS fix, to about 10 cm, unless the recording is full. An accuracy the phone
 * did not give is kept as -1.
 */
export function recordFix(recording: Recording, fix: LatLng & { at: number; accuracy: number | null }): void {
  const ms = fix.at - recording.startedAt;
  if (ms < 0 || !recordingHasRoom(ms)) return;
  recording.fixes.push([ms, round(fix.lat, 6), round(fix.lng, 6), round(fix.accuracy ?? -1, 1)]);
}

/** Adds a heading reading, to a tenth of a degree, unless the recording is full. A tilt not known is kept as -1. */
export function recordHeading(
  recording: Recording,
  reading: { at: number; motion: number | null; compass: number | null; level: number; tilt: number | null },
): void {
  const ms = reading.at - recording.startedAt;
  if (ms < 0 || !recordingHasRoom(ms)) return;
  const degrees = (value: number | null) => (value === null ? null : round(value, 1) % 360);
  recording.headings.push([ms, degrees(reading.motion), degrees(reading.compass), reading.level, round(reading.tilt ?? -1, 0)]);
}
