import type * as Phone from './walkRecording';
import type { Recording } from '../lib/simulateWalk';

// The desktop web preview's stand-in for walkRecording.ts; the iPhone never loads this
// file. The recording is kept in memory and is gone on reload.

let kept: Recording | null = null;

export const saveRecording: typeof Phone.saveRecording = (recording) => {
  kept = recording;
};
export const loadRecording: typeof Phone.loadRecording = () => kept;
export const hasRecording: typeof Phone.hasRecording = () => kept !== null;
export const recordingUri: typeof Phone.recordingUri = () => '';
export const dropRecording: typeof Phone.dropRecording = () => {
  kept = null;
};
