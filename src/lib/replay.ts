import { useCallback, useEffect, useRef, useState } from 'react';

import { latestAt, type Fix, type HeadingReading, type Track } from './simulateWalk';

/** How often the replay looks at its clock: quick enough for ten headings a second. */
const TICK_MS = 50;

export type Replay = {
  /** The latest fix reached, or null before the first. The same object until the next one. */
  fix: Fix | null;
  /** Seconds played and in all, for the progress line; updated about twice a second. */
  played: number;
  total: number;
  done: boolean;
  restart: () => void;
};

/**
 * Plays a track back in real time, or `speed` times faster, while `playing`. Fixes come
 * back as state, at most one change per fix; headings go to `onHeading` as they are
 * reached, without re-rendering anything, as live compass readings would.
 */
export function useReplay(
  track: Track | null,
  playing: boolean,
  speed: number,
  onHeading: (reading: HeadingReading) => void,
): Replay {
  const latestHeading = useRef(onHeading);
  useEffect(() => {
    latestHeading.current = onHeading;
  }, [onHeading]);

  const elapsed = useRef(0);
  const headingIndex = useRef(-1);
  const [fixIndex, setFixIndex] = useState(-1);
  const [played, setPlayed] = useState(0);

  const restart = useCallback(() => {
    elapsed.current = 0;
    headingIndex.current = -1;
    setFixIndex(-1);
    setPlayed(0);
  }, []);

  // A new track starts from its beginning: the screen's numbers at once, the clock as
  // soon as it next runs.
  const [current, setCurrent] = useState(track);
  if (track !== current) {
    setCurrent(track);
    setFixIndex(-1);
    setPlayed(0);
  }
  const clockTrack = useRef(track);

  useEffect(() => {
    if (clockTrack.current !== track) {
      clockTrack.current = track;
      elapsed.current = 0;
      headingIndex.current = -1;
    }
    if (!track || !playing) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      elapsed.current = Math.min(track.duration, elapsed.current + (now - last) * speed);
      last = now;
      const h = latestAt(track.headings, elapsed.current);
      if (h >= 0 && h !== headingIndex.current) {
        headingIndex.current = h;
        latestHeading.current(track.headings[h]);
      }
      // Both bail out without a render when nothing has changed.
      setFixIndex(latestAt(track.fixes, elapsed.current));
      setPlayed(Math.floor(elapsed.current / 500) / 2);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [track, playing, speed]);

  const fix = track && fixIndex >= 0 ? track.fixes[fixIndex] : null;
  return {
    fix,
    played,
    total: track ? track.duration / 1000 : 0,
    done: !!track && fixIndex === track.fixes.length - 1 && played * 1000 >= track.duration - 500,
    restart,
  };
}
