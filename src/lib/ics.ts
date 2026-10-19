import ICAL from 'ical.js';

import type { ImportedEvent } from '../types';
import { dayStart, startOfDay } from './dates';

// Reads a calendar file (.ics) into events the importer takes (src/lib/importPlan.ts).
//
// The file comes from outside, so nothing in it is trusted. A file that is not a
// calendar is refused with a message a screen can show; an event that cannot be read
// is skipped and counted, and never stops the rest.
//
// ical.js does the parsing and is kept to that. Two things it can be made to do never
// finish on a file written to that end: laying out a repeating event, and working out
// a time zone from the rules in the file. So repeating events are left out and counted
// (the iPhone's own calendar hands them over already laid out), times are read here
// as they are written, and a zone defined in the file is only given to ical.js once
// its rules have been checked.

const MAX_CHARS = 2_000_000;
const MAX_EVENTS = 2000;
/** What makes an entry a repeating event, or one changed occurrence of one. */
const REPEATS = ['rrule', 'rdate', 'recurrence-id'];
/** ical.js lays a zone out to this many years past today, whatever it is asked. */
const ZONE_YEARS_AHEAD = 5;
// Laying a zone out costs ical.js a step for each rule, for each year since the rule
// began, and a little to start each rule however recent. This is what all the zones in
// a file may cost between them: two of Outlook's, which begin in 1601.
const MAX_ZONE_STEPS = 2000;
const RULE_START_STEPS = 25;
/** No zone needs a rule older than Outlook's. */
const FIRST_RULE_YEAR = 1601;

type Wall = readonly [year: number, month: number, day: number, hour: number, minute: number, second: number];
/** The moment a zone the file defines shows a time on its clocks, if the zone can be used. */
type FileZones = (tzid: string, wall: Wall) => number | undefined;

const text = (value: unknown) => (typeof value === 'string' ? value : '');
/** A date or a time exactly as the file has it, in the form ical.js keeps: 2026-10-17T19:00:00Z. */
const written = (line: ICAL.Property | null) => text(line?.jCal[3]);

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

/** The one kind of rule a clock change needs: every year, on one numbered weekday of one month. */
function isClockChange(rule: ICAL.Recur): boolean {
  const { BYMONTH, BYDAY, ...others } = rule.parts;
  return (
    rule.freq === 'YEARLY' &&
    rule.interval === 1 &&
    Object.keys(others).length === 0 &&
    BYMONTH?.length === 1 &&
    BYDAY?.length === 1 &&
    // The second Sunday, the last Sunday: never "every Sunday", or the 53rd.
    /^-?[1-5][A-Z]{2}$/.test(BYDAY[0])
  );
}

/**
 * Whether ical.js may be given a zone the file defines. To say what the zone's clocks
 * read it walks every rule in it, year by year, with no limit of its own: a rule that
 * repeats by the minute, or asks for a 30th of February, never comes back, and the app
 * freezes. So every rule has to be an ordinary clock change, and the walk has to fit
 * in what is left of the file's allowance, `steps`.
 */
function isPlainZone(vtimezone: ICAL.Component, steps: { left: number }, lastYear: number): boolean {
  try {
    let cost = 0;
    for (const part of vtimezone.getAllSubcomponents()) {
      // In anything but these two, ical.js goes looking through the file for a zone.
      if (part.name !== 'standard' && part.name !== 'daylight') return false;
      const rules = part.getAllProperties('rrule');
      if (!rules.every((rule) => isClockChange(rule.getFirstValue() as ICAL.Recur))) return false;
      const began = Number(/^\d{4}/.exec(written(part.getFirstProperty('dtstart')))?.[0]);
      if (!(began >= FIRST_RULE_YEAR)) return false;
      cost += rules.length * Math.max(RULE_START_STEPS, lastYear - began);
    }
    if (cost > steps.left) return false;
    steps.left -= cost;
    return true;
  } catch {
    return false;
  }
}

/** Reads the zones one calendar defines. Nothing is looked at until a zone is asked for. */
function fileZones(calendar: ICAL.Component, steps: { left: number }): FileZones {
  let defined: Map<string, ICAL.Component> | undefined;
  const usable = new Map<string, ICAL.Timezone | null>();
  return (tzid, wall) => {
    // ponytail: ical.js lays a zone out once, to a few years from now, and would start
    // again for every later time it met. So a time further ahead than that, in a zone
    // only the file defines, is read on this phone's clock. Lay such a zone out here,
    // by arithmetic, if that ever matters.
    const lastYear = new Date().getFullYear() + ZONE_YEARS_AHEAD;
    if (wall[0] > lastYear) return undefined;
    if (!usable.has(tzid)) {
      // Found by name here, once. ical.js would search the file again for every time.
      defined ??= new Map(
        calendar.getAllSubcomponents('vtimezone').map((zone) => [text(zone.getFirstPropertyValue('tzid')), zone]),
      );
      const vtimezone = defined.get(tzid);
      const plain = vtimezone !== undefined && isPlainZone(vtimezone, steps, lastYear);
      usable.set(tzid, plain ? new ICAL.Timezone({ component: vtimezone, tzid }) : null);
    }
    const zone = usable.get(tzid);
    if (!zone) return undefined;
    const [year, month, day, hour, minute, second] = wall;
    const offset = zone.utcOffset(
      ICAL.Time.fromData({ year, month: month + 1, day, hour, minute, second, isDate: false }),
    );
    if (zone.changes.length === 0) {
      // A definition with nothing in it says nothing, and ical.js would walk it again
      // for every time it was asked about.
      usable.set(tzid, null);
      return undefined;
    }
    return Date.UTC(...wall) - offset * 1000;
  };
}

/**
 * The moment a DTSTART or DTEND line stands for, and whether it is a date with no time.
 * The line is read as written and worked out here; ical.js's own reading of it would go
 * to the zones in the file unasked.
 */
function readTime(line: ICAL.Property | null, zones: FileZones): { at: number; allDay: boolean } {
  const match = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d):(\d\d)(Z)?)?$/.exec(written(line));
  if (!match) throw new Error('Not a date or a time.');
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  // A date with no time is that day on this phone, whatever zone the phone is in.
  if (match[4] === undefined) return { at: startOfDay(year, month - 1, day), allDay: true };
  const wall = [year, month - 1, day, hour, minute, second] as const;
  if (match[7]) return { at: Date.UTC(...wall), allDay: false };
  // A named zone is the phone's to work out first. If the phone does not know the
  // name, the file's own definition is used when it is plain enough to be safe. With
  // no zone at all, or no way of working one out, the time is on this phone's clock.
  const tzid = line?.getParameter('tzid');
  const zoned =
    typeof tzid === 'string' ? (inZone(tzid, Date.UTC(...wall)) ?? zones(tzid, wall)) : undefined;
  return { at: zoned ?? new Date(...wall).getTime(), allDay: false };
}

/** One entry of the file as the importer takes it. Throws when it has no usable start. */
function imported(vevent: ICAL.Component, zones: FileZones): ImportedEvent {
  const start = readTime(vevent.getFirstProperty('dtstart'), zones);
  const endLine = vevent.getFirstProperty('dtend');
  const duration = vevent.getFirstPropertyValue('duration');
  // An end, or failing that a length. A date's end is the day after its last day,
  // which is how the app holds it too; with neither, a date is one day and a time has
  // no length.
  let endsAt = start.allDay ? dayStart(start.at, 1) : start.at;
  if (endLine) endsAt = readTime(endLine, zones).at;
  else if (duration instanceof ICAL.Duration) {
    const seconds = duration.toSeconds();
    endsAt = start.allDay ? dayStart(start.at, Math.round(seconds / 86_400)) : start.at + seconds * 1000;
  }
  const title = text(vevent.getFirstPropertyValue('summary'));
  const name = text(vevent.getFirstProperty('organizer')?.getParameter('cn'));
  return {
    // Without a UID, the title and start stand in, so the same file read twice still
    // gives the same key.
    sourceId: text(vevent.getFirstPropertyValue('uid')) || `${title}|${new Date(start.at).toISOString()}`,
    title,
    startsAt: start.at,
    endsAt,
    allDay: start.allDay,
    locationText: text(vevent.getFirstPropertyValue('location')),
    // The organiser's name only, and not when the "name" is itself an email address:
    // nobody's address is kept.
    host: name.includes('@') ? '' : name,
    url: text(vevent.getFirstPropertyValue('url')) || null,
    description: text(vevent.getFirstPropertyValue('description')),
  };
}

/**
 * The events in a calendar file, whatever their date. `repeating` counts the repeating
 * events and changed occurrences that were left out. `skipped` counts everything else
 * that was: cancelled events, events that could not be read, and anything past the
 * limit. Throws, with a message fit to show, when the text is not a calendar at all.
 */
export function parseIcs(fileText: string): { events: ImportedEvent[]; skipped: number; repeating: number } {
  if (fileText.length > MAX_CHARS) throw new Error('This file is too big to import.');
  // Some programs put an invisible mark or blank lines before the first line.
  const body = fileText.trimStart();
  if (!/^BEGIN:VCALENDAR/i.test(body)) throw new Error('This file is not a calendar.');
  let calendars: ICAL.Component[];
  try {
    const parsed = ICAL.parse(body);
    // One calendar comes back on its own, several as a list.
    const each: unknown[][] = typeof parsed[0] === 'string' ? [parsed] : parsed;
    calendars = each.map((calendar) => new ICAL.Component(calendar));
  } catch {
    throw new Error('This calendar file is damaged and could not be read.');
  }

  const events: ImportedEvent[] = [];
  let skipped = 0;
  let repeating = 0;
  const zoneSteps = { left: MAX_ZONE_STEPS };
  for (const calendar of calendars) {
    const zones = fileZones(calendar, zoneSteps);
    for (const vevent of calendar.getAllSubcomponents('vevent')) {
      if (events.length >= MAX_EVENTS) {
        skipped++;
        continue;
      }
      try {
        if (REPEATS.some((name) => vevent.hasProperty(name))) repeating++;
        else if (text(vevent.getFirstPropertyValue('status')).toUpperCase() === 'CANCELLED') skipped++;
        else events.push(imported(vevent, zones));
      } catch {
        skipped++;
      }
    }
  }
  return { events, skipped, repeating };
}
