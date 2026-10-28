import { File, Paths } from 'expo-file-system';

import { parseRecording, type Recording } from '../lib/simulateWalk';

// The last AR Walk, recorded only while "Record AR walks" is on in Settings, Developer,
// so it can be replayed at a desk and shared for tuning. One file in the app's own
// folder, replaced by the next recorded walk. It holds where you walked, so it never
// leaves the phone unless you share it, and "Delete all data" removes it.

const file = () => new File(Paths.document, 'last-walk.json');

/** Writes the recording over the last one. Best effort: a full phone loses the recording, never the walk. */
export function saveRecording(recording: Recording): void {
  try {
    const target = file();
    if (!target.exists) target.create();
    target.writeSync(JSON.stringify(recording));
  } catch {
    // Nothing to tell the walker; the next walk tries again.
  }
}

/** The last recorded walk, or null if there is none or it cannot be read. */
export function loadRecording(): Recording | null {
  try {
    const source = file();
    return source.exists ? parseRecording(source.textSync()) : null;
  } catch {
    return null;
  }
}

export const hasRecording = (): boolean => file().exists;

/** Where the file is, for the share sheet. */
export const recordingUri = (): string => file().uri;

export function dropRecording(): void {
  const target = file();
  if (target.exists) target.delete();
}
