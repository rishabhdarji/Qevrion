import type { QevrionEvent } from '@/types';

import { sampleEvents } from './sampleEvents';

// The one place screens get events from. Round 1 returns the invented samples;
// Round 2 swaps these two bodies for the database and no screen changes.

export function useEvents(): QevrionEvent[] {
  return sampleEvents;
}

export function useEvent(id: string | undefined): QevrionEvent | undefined {
  return sampleEvents.find((event) => event.id === id);
}
