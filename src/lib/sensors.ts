import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { normalize } from './geo';
import { declination, facing } from './heading';

// The compass and motion sensors for AR Walk, followed only while a screen asks for
// them and let go of the moment it stops. Nothing here asks for a permission: motion
// needs none, and the compass rides on the location permission the screen already has.

export type HeadingSample = {
  /** When, in milliseconds since 1970. */
  at: number;
  /** True heading "ahead": from motion when it has one, else from the compass. */
  heading: number | null;
  /** True heading from the phone's motion (gyro-steadied), which the arrow uses. */
  motion: number | null;
  /** True heading from the compass alone, kept for comparison and as the fallback. */
  compass: number | null;
  /** The compass's calibration, 0 to 3 (see `compassNeedsCalibration`); -1 before the first reading. */
  level: number;
  /** 0 flat, 90 upright. Null when motion is not available. */
  tilt: number | null;
};

/** About 20 readings a second: smooth on screen, light on the battery. */
const MOTION_EVERY_MS = 50;
/** With no motion reading for this long, the compass alone drives the arrow. */
const MOTION_LOST_MS = 500;

/**
 * Calls `onSample` with each new reading while `enabled`. Readings do not re-render
 * anything: the caller keeps what it needs. The motion sensor and the compass are both
 * stopped when `enabled` goes false or the screen closes.
 */
export function useHeadingSamples(enabled: boolean, onSample: (sample: HeadingSample) => void): void {
  const latest = useRef(onSample);
  useEffect(() => {
    latest.current = onSample;
  }, [onSample]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let compass: number | null = null;
    let level = -1;
    // True north less magnetic north here, from the compass, for the motion heading.
    let offset: number | null = null;
    let lastMotion = 0;

    const send = (sample: Omit<HeadingSample, 'heading'>) => {
      if (!stopped) latest.current({ ...sample, heading: sample.motion ?? sample.compass });
    };

    // Without motion (as in a desktop browser), the compass alone drives the arrow.
    let motionSub: { remove: () => void } | undefined;
    DeviceMotion.isAvailableAsync()
      .then((available) => {
        if (!available || stopped) return;
        DeviceMotion.setUpdateInterval(MOTION_EVERY_MS);
        motionSub = DeviceMotion.addListener(({ rotation }) => {
          if (!rotation) return;
          const now = Date.now();
          lastMotion = now;
          const { heading, tilt } = facing(rotation);
          // Until the compass has said how far true north is from magnetic north here,
          // the motion heading cannot be trusted to a few degrees, so the compass leads.
          const motion = heading === null || offset === null ? null : normalize(heading + offset);
          send({ at: now, motion, compass, level, tilt });
        });
      })
      .catch(() => {});

    let compassWatch: Location.LocationSubscription | undefined;
    Location.watchHeadingAsync(
      (reading) => {
        compass = reading.trueHeading >= 0 ? reading.trueHeading : reading.magHeading;
        offset = declination(reading.trueHeading, reading.magHeading);
        level = reading.accuracy;
        const now = Date.now();
        // Motion is quiet (not available, or paused): the compass speaks for itself.
        if (now - lastMotion > MOTION_LOST_MS) send({ at: now, motion: null, compass, level, tilt: null });
      },
      () => {},
    )
      .then((subscription) => {
        if (stopped) subscription.remove();
        else compassWatch = subscription;
      })
      .catch(() => {
        // No compass: motion alone, measured from magnetic north.
        offset ??= 0;
      });

    return () => {
      stopped = true;
      motionSub?.remove();
      compassWatch?.remove();
    };
  }, [enabled]);
}

/** Whether the app is in front. Sensors and the camera pause while it is not. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}
