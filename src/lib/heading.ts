import { normalize } from './geo';

// Which way the phone faces, for AR Walk (SPEC 9: arrow rotation = bearing less the
// smoothed heading). Pure, so it is tested without a phone. Angles are degrees
// clockwise from north unless a name says radians.

/** An angle as -180 up to 180: the shorter way round from 0. */
export const signedAngle = (degrees: number) => {
  const a = normalize(degrees);
  return a > 180 ? a - 360 : a;
};

/**
 * The phone's orientation as `expo-sensors` DeviceMotion gives it on iOS: Apple's
 * yaw, pitch and roll in radians, measured from a frame whose X axis points to
 * magnetic north and whose Z axis points up (so its Y axis points west).
 */
export type Rotation = { alpha: number; beta: number; gamma: number };

export type Facing = {
  /** Magnetic heading "ahead", or null when the phone points straight up or down. */
  heading: number | null;
  /** 0 lying flat with the screen up, 90 held upright, 180 lying screen down. */
  tilt: number;
};

/**
 * Which way is ahead for someone holding the phone, from its orientation. Ahead is
 * where the back camera looks when the phone is held up, and where the top points when
 * it lies flat; in between it moves smoothly from one to the other, so there is no
 * jump as the phone is tilted. Unlike the compass's own heading, which follows the top
 * of the phone, this stays steady with the phone upright.
 *
 * The rotation matrix is Apple's (yaw about Z, then pitch about X, then roll about Y),
 * the same one WebKit builds to turn these angles into the browser's
 * deviceorientation. Its columns are the phone's axes in the north-west-up frame.
 */
export function facing({ alpha: yaw, beta: pitch, gamma: roll }: Rotation): Facing {
  const cZ = Math.cos(yaw);
  const sZ = Math.sin(yaw);
  const cX = Math.cos(pitch);
  const sX = Math.sin(pitch);
  const cY = Math.cos(roll);
  const sY = Math.sin(roll);
  // The phone's top (its y axis) and the way out of its screen (its z axis).
  const top = { north: -cX * sZ, west: cZ * cX };
  const screen = { north: cY * sZ * sX + cZ * sY, west: sZ * sY - cZ * cY * sX, up: cX * cY };
  // Top plus the way out of the back: whichever of the two lies flatter counts most.
  const north = top.north - screen.north;
  const east = -(top.west - screen.west);
  const tilt = (Math.acos(Math.max(-1, Math.min(1, screen.up))) * 180) / Math.PI;
  // Too short to have a direction: the phone points straight up or down.
  if (Math.hypot(north, east) < 0.2) return { heading: null, tilt };
  return { heading: normalize((Math.atan2(east, north) * 180) / Math.PI), tilt };
}

/**
 * How far true north is from magnetic north here, from one compass reading that has
 * both. Zero when the true heading is not known (the compass gives -1 for it then).
 */
export const declination = (trueHeading: number, magneticHeading: number) =>
  trueHeading >= 0 && magneticHeading >= 0 ? signedAngle(trueHeading - magneticHeading) : 0;

// The heading filter: a "one euro" filter (Casiez, Roussel and Vogel, 2012) worked on
// the angle the short way round, so 359 to 1 is a step of 2, not 358. Held still, it
// smooths hard and the arrow does not shiver; turning, it lets go, so the arrow keeps
// up. Tuned by eye for v0.0.1; the outdoor test may move these numbers.

/** Smoothing when still, in hertz: lower is steadier but slower. */
export const STILL_CUTOFF_HZ = 0.5;
/** How much faster the filter follows per degree a second of turning. */
export const TURN_RESPONSE = 0.03;
/** Smoothing of the turning speed itself, in hertz. */
const SPEED_CUTOFF_HZ = 1;
/** A gap longer than this starts the filter afresh rather than sweeping across it. */
const STALE_MS = 1000;

export type HeadingFilter = {
  /** The smoothed heading. */
  value: number;
  /** Degrees a second, smoothed: positive is turning clockwise. */
  speed: number;
  /** When it was last fed, in milliseconds. */
  at: number;
};

const share = (cutoffHz: number, seconds: number) => 1 / (1 + 1 / (2 * Math.PI * cutoffHz * seconds));

/** The filter after one more reading, taken at `at` milliseconds. */
export function filterHeading(previous: HeadingFilter | null, reading: number, at: number): HeadingFilter {
  if (!previous || at - previous.at > STALE_MS || at <= previous.at) {
    return { value: normalize(reading), speed: 0, at };
  }
  const seconds = (at - previous.at) / 1000;
  const step = signedAngle(reading - previous.value);
  const speed = previous.speed + share(SPEED_CUTOFF_HZ, seconds) * (step / seconds - previous.speed);
  const cutoff = STILL_CUTOFF_HZ + TURN_RESPONSE * Math.abs(speed);
  return { value: normalize(previous.value + share(cutoff, seconds) * step), speed, at };
}

/**
 * An angle eased toward a target over time, the short way round: `seconds` is how long
 * it takes to cover about two thirds of the way. Used for the bearing to the target,
 * which jumps when a GPS fix lands or a turn is reached.
 */
export function easeAngle(current: number, target: number, elapsedMs: number, seconds: number): number {
  const part = 1 - Math.exp(-Math.max(0, elapsedMs) / 1000 / seconds);
  return normalize(current + part * signedAngle(target - current));
}

/**
 * The compass's own calibration as Expo gives it on iOS: 3 is within 20 degrees,
 * 2 within 35, 1 within 50, and 0 worse or unknown. 1 or 0 is worth a word.
 */
export const compassNeedsCalibration = (level: number) => level <= 1;
