import { useSyncExternalStore } from 'react';

import { findConflicts } from '@/lib/conflicts';
import { covers } from '@/theme';
import type { EventFields, QevrionEvent } from '@/types';

import * as db from './db';
import { makeSampleEvents } from './sampleEvents';

// The one place screens get events from, and the one place they change them.
//
// Every event is kept in memory, read from the database on first use and again after
// each change, so lists, search and filters never wait on a query.
// ponytail: fine for a few thousand events. Past that, search and filtering move
// into SQL and this holds only what is on screen.

const palette = Object.values(covers);

let events: QevrionEvent[] | undefined;
const listeners = new Set<() => void>();

function load(): QevrionEvent[] {
  const stored = db.listEvents().sort((a, b) => a.startsAt - b.startsAt);
  const conflicts = findConflicts(stored);
  return stored.map(({ sourceId, ...event }) => ({
    ...event,
    isSample: sourceId?.startsWith(db.SAMPLE_PREFIX) ?? false,
    // No stored image yet, so each event keeps one wash, picked by its id.
    cover: palette[[...event.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length],
    hasConflict: conflicts.has(event.id),
  }));
}

const getSnapshot = () => (events ??= load());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function changed() {
  events = undefined;
  listeners.forEach((listener) => listener());
}

/** Every event, soonest first. */
export function useEvents(): QevrionEvent[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useEvent(id: string | undefined): QevrionEvent | undefined {
  return useEvents().find((event) => event.id === id);
}

/** Adds an event, or with `id` updates that one. */
export function saveEvent(fields: EventFields, id?: string): void {
  db.saveEvent(fields, id);
  changed();
}

export function removeEvent(id: string): void {
  db.deleteEvent(id);
  changed();
}

/** Puts in a fresh set of sample events, replacing any that are already there. */
export function insertSampleEvents(): void {
  db.replaceSampleEvents(makeSampleEvents(Date.now()));
  changed();
}

export function removeSampleEvents(): void {
  db.deleteSampleEvents();
  changed();
}

export function deleteAllData(): void {
  db.deleteAllData();
  changed();
}
