import type { Event } from 'expo-calendar/legacy';

import type { ImportedEvent } from '../types';
import { dayStart } from './dates';
import { isPartifulLink, webLink } from './links';

// Turns what the iPhone calendar hands over into events the importer takes
// (src/lib/importPlan.ts). Pure, so the rules are tested without a phone; reading the
// calendar itself is src/lib/sync.ts.

/**
 * A calendar event as iOS really hands it over: any field can be missing, and text
 * the package's types promise can be null.
 */
export type CalendarEvent = { [Key in keyof Event]?: Event[Key] | null };

// iOS says "cancelled"; the package's own types spell it "canceled".
const CANCELLED = ['cancelled', 'canceled'];

const text = (value: unknown) => (typeof value === 'string' ? value : '');
/** Milliseconds, or NaN for a date that is missing or cannot be read (the importer skips those). */
const time = (value: unknown) =>
  typeof value === 'string' || value instanceof Date ? new Date(value).getTime() : NaN;
const iso = (ms: number) => (Number.isFinite(ms) ? new Date(ms).toISOString() : '');

/** The first Partiful link written in some text that is safe to offer, or null. */
function partifulLinkIn(value: unknown): string | null {
  for (const [found] of text(value).matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    // The full stop or bracket that ends a sentence is not part of the link.
    const link = webLink(found.replace(/[.,;:!?)\]}]+$/, ''));
    if (link && isPartifulLink(link)) return link;
  }
  return null;
}

/** One calendar event as the importer takes it, or null for a cancelled one. */
export function toImported(event: CalendarEvent): ImportedEvent | null {
  if (CANCELLED.includes(String(event.status))) return null;
  let startsAt = time(event.startDate);
  let endsAt = time(event.endDate);
  if (event.allDay === true) {
    // iOS ends an all-day event at the last moment of its last day, 23:59:59, where
    // the app holds the first moment of the day after.
    const start = dayStart(startsAt);
    endsAt = endsAt > start && dayStart(endsAt) === endsAt ? endsAt : dayStart(endsAt, 1);
    startsAt = start;
  }
  // Every occurrence of a repeating event shares one id, so its original start is
  // added: the start it had before anyone moved it, so a moved occurrence keeps its
  // key, and with it the owner's notes. A missing id gives an empty key, which the
  // importer skips and counts.
  const repeats = !!event.recurrenceRule || event.isDetached === true;
  const original = time(event.originalStartDate);
  const id = text(event.calendarId) && text(event.id) ? `${event.calendarId}|${event.id}` : '';
  const name = text(event.organizer?.name);
  return {
    sourceId: id && repeats ? `${id}|${iso(Number.isFinite(original) ? original : time(event.startDate))}` : id,
    title: text(event.title),
    startsAt,
    endsAt,
    allDay: event.allDay === true,
    // Calendar places often come as "Venue" over "Street, City": one line reads better.
    locationText: text(event.location).trim().replace(/[\s,]*[\r\n][\s,]*/g, ', '),
    // The organiser's name only, never an email address.
    host: name.includes('@') ? '' : name,
    // Partiful may put its link in any of the three, so all are looked at.
    url: webLink(event.url) ?? partifulLinkIn(event.notes) ?? partifulLinkIn(event.location),
    description: text(event.notes),
  };
}

/** The same rule the database uses for the Partiful tag: partiful.com anywhere in the event. */
export const isPartifulEvent = (event: CalendarEvent): boolean =>
  /partiful\.com/i.test([event.url, event.notes, event.location].map(text).join(' '));

/**
 * What a sync hands the importer. `present` is the key of every event the calendars
 * returned, before the Partiful switch, so an event that was only switched off is
 * never taken for one the calendar lost; `filtered` is how many the switch left out.
 */
export function collect(
  events: readonly CalendarEvent[],
  onlyPartiful: boolean,
): { incoming: ImportedEvent[]; present: string[]; filtered: number } {
  const incoming: ImportedEvent[] = [];
  const present: string[] = [];
  let filtered = 0;
  for (const raw of events) {
    const event = toImported(raw);
    if (!event) continue;
    present.push(event.sourceId);
    if (onlyPartiful && !isPartifulEvent(raw)) filtered++;
    else incoming.push(event);
  }
  return { incoming, present, filtered };
}
