import ICAL from 'ical.js';

import type { ImportedEvent } from '../types';
import { startOfDay } from './dates';

// Reads a calendar file (.ics) into events the importer takes (src/lib/importPlan.ts).
//
// The file comes from outside, so nothing in it is trusted. A file that is not a
// calendar is refused with a message a screen can show; an event that cannot be read
// is skipped and counted, and never stops the rest. ical.js does the parsing. What is
// added here is what the app needs on top of it: every time as a moment on this phone,
// repeating events laid out one occurrence at a time, and a limit on all of it.

const MAX_CHARS = 5_000_000;
const MAX_EVENTS = 5000;
/** Occurrences taken from one repeating event. */
const MAX_REPEATS = 500;
// ponytail: ical.js can only walk a repeating event from its first occurrence, so a
// daily event that began years ago takes thousands of steps to reach the dates asked
// for, all of it while the app waits. After this long, repeating events still to be
// laid out are skipped and counted. Lay them out off the main thread, or skip ahead by
// arithmetic, if real files reach it.
const MAX_REPEAT_MS = 3000;

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const iso = (ms: number) => new Date(ms).toISOString();
const uidOf = (vevent: ICAL.Component) => text(vevent.getFirstPropertyValue('uid'));
const zoneOf = (vevent: ICAL.Component, name: string) => vevent.getFirstProperty(name)?.getParameter('tzid');
const isCancelled = (vevent: ICAL.Component) =>
  text(vevent.getFirstPropertyValue('status')).toUpperCase() === 'CANCELLED';

// Built once per zone: making a formatter is far dearer than using one.
const zoneClocks = new Map<string, Intl.DateTimeFormat>();

/**
 * The moment at which clocks in a named zone show a given time, that time being
 * written as if it were UTC. Undefined when this phone cannot say, which is what
 * happens with a name it does not know, such as Windows' "Eastern Standard Time".
 */
function inZone(timeZone: string, wall: number): number | undefined {
  try {
    const known = zoneClocks.get(timeZone);
    const clock =
      known ??
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
    if (!known) zoneClocks.set(timeZone, clock);
    /** How far the zone's clocks are ahead of UTC at a moment. */
    const offsetAt = (ms: number) => {
      const part: Record<string, number> = {};
      for (const { type, value } of clock.formatToParts(ms)) part[type] = Number(value);
      // Some phones write midnight as hour 24.
      return Date.UTC(part.year, part.month - 1, part.day, part.hour % 24, part.minute, part.second) - ms;
    };
    // Two passes. The first offset is read a few hours away from the moment wanted,
    // which is only wrong next to a clock change; the second is read where the first
    // one points, and is right.
    const moment = wall - offsetAt(wall - offsetAt(wall));
    return Number.isFinite(moment) ? moment : undefined;
  } catch {
    return undefined;
  }
}

/** The moment a time in the file stands for. `tzid` is the zone its line names, if any. */
function toMs(time: ICAL.Time, tzid: unknown): number {
  // A date with no time is that day on this phone, whatever zone the phone is in.
  if (time.isDate) return startOfDay(time.year, time.month - 1, time.day);
  // UTC, or a zone the file itself defines: ical.js knows the exact moment.
  if (time.zone !== ICAL.Timezone.localTimezone) return time.toJSDate().getTime();
  const wall = [time.year, time.month - 1, time.day, time.hour, time.minute, time.second] as const;
  // A zone the file names but does not define. ical.js would read the time on this
  // phone's clock, which is wrong anywhere else, so the phone's own knowledge of the
  // zone is used. With no zone, or one the phone does not know, it is this phone's clock.
  const zoned = typeof tzid === 'string' ? inZone(tzid, Date.UTC(...wall)) : undefined;
  return zoned ?? new Date(...wall).getTime();
}

/**
 * Whether a repeat rule is one ical.js can be trusted with. For a rule that steps by
 * the day or the week it tries one date after another until the rule's conditions
 * are met, with no limit: given conditions that are never met, such as a 30th of
 * February, it would not come back and the app would freeze. Only rules whose
 * conditions always come round are let through. No invitation needs the others.
 */
function canExpand(rule: ICAL.Recur): boolean {
  const { freq, parts } = rule;
  if (freq === 'MONTHLY' || freq === 'YEARLY') return true;
  if (freq !== 'DAILY' && freq !== 'WEEKLY') return false;
  if (parts.BYMONTHDAY || parts.BYYEARDAY || parts.BYWEEKNO) return false;
  // "MO" comes round every week. "2MO", the second Monday, only means something in a
  // month or a year.
  return freq === 'WEEKLY' || (parts.BYDAY ?? []).every((day) => /^[A-Z]{2}$/.test(day));
}

/** One event, or one occurrence of a repeating one, as the importer takes it. */
function imported(item: ICAL.Event, sourceId: string, start: ICAL.Time, end: ICAL.Time): ImportedEvent {
  const vevent = item.component;
  const startZone = zoneOf(vevent, 'dtstart');
  return {
    sourceId,
    title: text(item.summary),
    startsAt: toMs(start, startZone),
    // A date's end is the day after its last day, which is how the app holds it too.
    endsAt: toMs(end, zoneOf(vevent, 'dtend') ?? startZone),
    allDay: start.isDate,
    locationText: text(item.location),
    // The organiser's name only. What follows it in the file is an email address,
    // which is not kept.
    host: text(vevent.getFirstProperty('organizer')?.getParameter('cn')),
    url: text(vevent.getFirstPropertyValue('url')) || null,
    description: text(item.description),
  };
}

/**
 * The events in a calendar file. One-off events are all read, whatever their date.
 * A repeating event gives one event per occurrence that falls between `from` and `to`.
 * `skipped` counts what was left out: cancelled events, events that could not be read,
 * and anything past the limits above. Throws, with a message fit to show, when the
 * text is not a calendar at all.
 */
export function parseIcs(
  fileText: string,
  window: { from: number; to: number },
): { events: ImportedEvent[]; skipped: number } {
  if (fileText.length > MAX_CHARS) throw new Error('This file is too big to import.');
  // Some programs put an invisible mark or blank lines before the first line.
  const body = fileText.trimStart();
  if (!/^BEGIN:VCALENDAR/i.test(body)) throw new Error('This file is not a calendar.');
  let vevents: ICAL.Component[];
  try {
    const parsed = ICAL.parse(body);
    // One calendar comes back on its own, several as a list.
    const calendars: unknown[][] = typeof parsed[0] === 'string' ? [parsed] : parsed;
    vevents = calendars.flatMap((calendar) => new ICAL.Component(calendar).getAllSubcomponents('vevent'));
  } catch {
    throw new Error('This calendar file is damaged and could not be read.');
  }

  // A changed occurrence of a repeating event is an entry of its own in the file, with
  // the event's UID. They are handed to ical.js with the event they belong to.
  const repeating = new Set<string>();
  const changes = new Map<string, ICAL.Component[]>();
  for (const vevent of vevents) {
    const uid = uidOf(vevent);
    if (!uid) continue;
    if (!vevent.hasProperty('recurrence-id')) repeating.add(uid);
    else if (changes.has(uid)) changes.get(uid)!.push(vevent);
    else changes.set(uid, [vevent]);
  }

  const events: ImportedEvent[] = [];
  let skipped = 0;
  const deadline = Date.now() + MAX_REPEAT_MS;

  for (const vevent of vevents) {
    if (events.length >= MAX_EVENTS) {
      skipped++;
      continue;
    }
    try {
      const uid = uidOf(vevent);
      const isChange = vevent.hasProperty('recurrence-id');
      // Comes out with the occurrences of the event it belongs to.
      if (isChange && repeating.has(uid)) continue;
      if (isCancelled(vevent)) {
        skipped++;
        continue;
      }
      // Told which changes are its own, ical.js does not go looking through the file.
      const event = new ICAL.Event(vevent, { exceptions: (!isChange && changes.get(uid)) || [] });
      const startZone = zoneOf(vevent, 'dtstart');
      // Without a UID, the title and start stand in, so the same file read twice
      // still gives the same key.
      const key = uid || `${text(event.summary)}|${iso(toMs(event.startDate, startZone))}`;

      if (!event.isRecurring()) {
        // A changed occurrence whose event is not in the file is kept as one event.
        const occurrence = isChange ? `|${iso(toMs(event.recurrenceId, zoneOf(vevent, 'recurrence-id')))}` : '';
        events.push(imported(event, key + occurrence, event.startDate, event.endDate));
        continue;
      }

      const rules = vevent.getAllProperties('rrule').map((rule) => rule.getFirstValue() as ICAL.Recur);
      if (Date.now() > deadline || !rules.every(canExpand)) {
        skipped++;
        continue;
      }
      const expansion = event.iterator();
      let taken = 0;
      for (let next = expansion.next(); next; next = expansion.next()) {
        // Occurrences come in order, so the first one past the window ends the walk.
        const original = toMs(next, startZone);
        if (original > window.to) break;
        // Out of time or out of room: what is left of this event is skipped.
        if (Date.now() > deadline || taken >= MAX_REPEATS || events.length >= MAX_EVENTS) {
          skipped++;
          break;
        }
        // The occurrence as it stands, which a change may have moved or rewritten.
        // Its key is its original start, so it stays the same event when moved again.
        const { item, startDate, endDate } = event.getOccurrenceDetails(next);
        const occurrence = imported(item, `${key}|${iso(original)}`, startDate, endDate);
        if (occurrence.startsAt > window.to || occurrence.endsAt < window.from) continue;
        if (isCancelled(item.component)) {
          skipped++;
          continue;
        }
        events.push(occurrence);
        taken++;
      }
    } catch {
      skipped++;
    }
  }
  return { events, skipped };
}
