import { useSyncExternalStore } from 'react';

import { findConflicts } from '../lib/conflicts';
import { covers } from '../theme';
import type { EventFields, ImportedEvent, ImportResult, ImportScope, QevrionEvent } from '../types';
import * as db from './db';
import { dropAllPhotos, dropPhoto, keepPhoto, photoName, photoUri } from './photos';
import { makeSampleEvents } from './sampleEvents';
import { setRouteKey } from './secrets';

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
  // An event its calendar no longer has is not going ahead, so it clashes with nothing.
  const conflicts = findConflicts(stored.filter((event) => !event.removedFromSource));
  return stored.map(({ sourceId, photo, ...event }) => ({
    ...event,
    photo: photo ? photoUri(photo) : null,
    // An imported event is never a sample, whatever its key happens to say.
    isSample: event.source === 'manual' && (sourceId?.startsWith(db.SAMPLE_PREFIX) ?? false),
    // Shown where an event has no photo: each keeps one wash, picked by its id.
    cover: palette[[...event.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length],
    hasConflict: conflicts.has(event.id),
  }));
}

/** Every event, soonest first. For code that is not a component; components use `useEvents`. */
export const getEvents = (): QevrionEvent[] => (events ??= load());

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

/** Deletes the photo files of events that are about to go. */
function dropPhotosOf(going: QevrionEvent[]) {
  going.forEach((event) => event.photo && dropPhoto(photoName(event.photo)));
}

/** Every event, soonest first. */
export function useEvents(): QevrionEvent[] {
  return useSyncExternalStore(subscribe, getEvents);
}

export function useEvent(id: string | undefined): QevrionEvent | undefined {
  return useEvents().find((event) => event.id === id);
}

/** Adds an event, or with `id` updates that one. */
export function saveEvent(fields: EventFields, id?: string): void {
  const before = getEvents().find((event) => event.id === id)?.photo ?? null;
  const shown = fields.photo ?? null;
  // A newly picked photo is copied in before the event is written, and the one it
  // replaces is only deleted afterwards, so a failed save loses nothing.
  const name = shown === before ? before && photoName(before) : shown && keepPhoto(shown);
  db.saveEvent({ ...fields, photo: name }, id);
  if (before && shown !== before) dropPhoto(photoName(before));
  changed();
}

/** An imported event stays stored, hidden, so that a sync does not bring it back. Its photo goes all the same. */
export function removeEvent(id: string): void {
  const going = getEvents().filter((event) => event.id === id);
  db.deleteEvent(id);
  dropPhotosOf(going);
  changed();
}

/** Brings in events from a calendar or a file, and says how many were added, changed and so on. */
export function importEvents(incoming: ImportedEvent[], scope: ImportScope): ImportResult {
  const { wrote, ...result } = db.importEvents(incoming, scope);
  // A sync runs on every app open and usually finds nothing new: then nothing redraws.
  if (wrote) changed();
  return result;
}

/** The next address to find on the map, or null when none is waiting. */
export function nextPendingAddress(): string | null {
  const { address, reused } = db.nextPendingAddress();
  // Events that share an address already looked up were filled in on the way.
  if (reused > 0) changed();
  return address;
}

/**
 * Records where an address is, or with null that it could not be found. The screens
 * see it at the next `showLocations`, so a run of answers redraws them once.
 */
export function setGeocode(address: string, found: { lat: number; lng: number } | null): void {
  db.setGeocode(address, found);
}

/** Shows the screens what `setGeocode` has written since. */
export const showLocations = (): void => changed();

/** Puts in a fresh set of sample events, replacing any that are already there. */
export function insertSampleEvents(): void {
  const going = getEvents().filter((event) => event.isSample);
  db.replaceSampleEvents(makeSampleEvents(Date.now()));
  dropPhotosOf(going);
  changed();
}

export function removeSampleEvents(): void {
  const going = getEvents().filter((event) => event.isSample);
  db.deleteSampleEvents();
  dropPhotosOf(going);
  changed();
}

/** Every event, photo, saved route and setting, and the route key. */
export function deleteAllData(): void {
  db.deleteAllData();
  dropAllPhotos();
  // The keychain answers later; the rest is already gone.
  setRouteKey(null).catch(() => {});
  changed();
}
