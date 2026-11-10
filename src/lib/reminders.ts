import type { QevrionEvent, Settings } from '../types';
import { dayStart, formatEventWhen, formatTime } from './dates';

// The reminder scheduler, SPEC section 8. Nothing here touches the phone: it is given
// the events, the settings, the time, and two small doors (`os` for the iPhone's
// notifications, `store` for the ScheduledNotification table), so every rule is tested
// with fakes. src/lib/reminderSync.ts hands it the real ones.
//
//   1. `buildFireTimes` lists every future fire time: each event's reminders, the
//      morning digests and the Sunday previews.
//   2. `nearest` keeps the soonest 60. iOS holds 64 for an app and drops the rest.
//   3. The app calls `reconcile` on opening, after an import, after an event or a
//      setting changes, and when a notification is tapped.
//   4. `diffSchedule` makes a re-run cancel and replace only what changed.

/** iOS keeps at most 64 pending notifications per app; four are left spare. */
export const MAX_SCHEDULED = 60;

const MINUTE = 60_000;
const DAY_MINUTES = 1440;
/** An all-day event has no start time, so its reminders count back from 9:00 AM. */
const ALL_DAY_ANCHOR = 9 * 60;
/** A digest covers a long all-day event for at most this many of its days. */
const MAX_DAYS = 31;

export type ReminderKind = 'reminder' | 'digest' | 'weekly';

export type ReminderEvent = Pick<
  QevrionEvent,
  | 'id'
  | 'title'
  | 'startsAt'
  | 'endsAt'
  | 'allDay'
  | 'locationText'
  | 'removedFromSource'
  | 'reminderOffsets'
>;

export type ReminderSettings = Pick<
  Settings,
  'defaultOffsets' | 'digestEnabled' | 'digestTime' | 'weeklyPreviewEnabled' | 'weeklyPreviewTime'
>;

/** One notification that should fire. `id` says what it is for, and never changes. */
export type FireTime = {
  id: string;
  /** Null for a digest or a preview, which belong to no single event. */
  eventId: string | null;
  kind: ReminderKind;
  fireAt: number;
  title: string;
  body: string;
};

/** A row of ScheduledNotification (SPEC section 7): what was handed to iOS. */
export type Recorded = {
  id: string;
  eventId: string | null;
  kind: ReminderKind;
  fireAt: number;
  osNotificationId: string;
  /** The time and wording it was scheduled with, to tell when it must be replaced. */
  signature: string;
};

/** A notification iOS is holding. */
export type Pending = {
  osNotificationId: string;
  /** Made by this app's scheduler or its test button, not by something else. */
  ours: boolean;
  /** The Settings test notification, which the scheduler leaves alone. */
  test: boolean;
};

/** The choices offered for "how long before", in minutes. */
export const OFFSET_CHOICES = [0, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080];

/** "30 minutes", "2 hours", "1 day", "1 week". */
export function offsetLabel(minutes: number): string {
  const [n, unit] =
    minutes % 10080 === 0 && minutes > 0
      ? [minutes / 10080, 'week']
      : minutes % DAY_MINUTES === 0 && minutes > 0
        ? [minutes / DAY_MINUTES, 'day']
        : minutes % 60 === 0 && minutes > 0
          ? [minutes / 60, 'hour']
          : [minutes, 'minute'];
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/** "1 day, 2 hours and 30 minutes before", "At the start", or "None". */
export function offsetsSummary(offsets: readonly number[]): string {
  const sorted = cleanOffsets(offsets).reverse();
  if (sorted.length === 0) return 'None';
  const labels = sorted.map((m) => (m === 0 ? 'at the start' : offsetLabel(m)));
  const last = labels.pop()!;
  const text = labels.length > 0 ? `${labels.join(', ')} and ${last}` : last;
  const sentence = sorted[sorted.length - 1] === 0 ? text : `${text} before`;
  return sentence[0].toUpperCase() + sentence.slice(1);
}

/** Whole minutes, none negative, none twice, shortest first. */
export function cleanOffsets(offsets: readonly number[]): number[] {
  return [...new Set(offsets.filter((m) => Number.isInteger(m) && m >= 0))].sort((a, b) => a - b);
}

/** Today at `minutes` after midnight, which is what a time picker wants to be given. */
export const timeToday = (minutes: number): Date => new Date(atMinutes(Date.now(), minutes));

/** "8:00 AM" for 480 minutes after midnight. */
export const formatMinutes = (minutes: number): string => formatTime(timeToday(minutes).getTime());

/** The moment `minutes` after midnight on the day `ms` falls in, on this phone's clock. */
export function atMinutes(ms: number, minutes: number): number {
  const day = new Date(ms);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes).getTime();
}

const plural = (n: number) => `${n} event${n === 1 ? '' : 's'}`;

const byStart = (a: ReminderEvent, b: ReminderEvent) =>
  a.startsAt - b.startsAt || (a.id < b.id ? -1 : 1);

/** The offsets an event uses: its own when it has them, otherwise the defaults. */
export const offsetsFor = (event: ReminderEvent, settings: ReminderSettings): number[] =>
  cleanOffsets(event.reminderOffsets ?? settings.defaultOffsets);

function eventReminders(event: ReminderEvent, settings: ReminderSettings): FireTime[] {
  const place = event.locationText ? ` · ${event.locationText}` : '';
  return offsetsFor(event, settings).flatMap((offset) => {
    // "30 minutes before" an all-day event would be half past eleven the night
    // before. Only reminders of a day or more are kept, counted from 9:00 AM.
    if (event.allDay && offset < DAY_MINUTES) return [];
    const anchor = event.allDay ? atMinutes(event.startsAt, ALL_DAY_ANCHOR) : event.startsAt;
    const lead = offset === 0 ? 'Starting now' : `In ${offsetLabel(offset)}`;
    const when =
      offset >= DAY_MINUTES || event.allDay ? formatEventWhen(event) : formatTime(event.startsAt);
    return [
      {
        id: `r:${event.id}:${offset}`,
        eventId: event.id,
        kind: 'reminder' as const,
        fireAt: anchor - offset * MINUTE,
        title: event.title,
        body: `${lead} · ${when}${place}`,
      },
    ];
  });
}

/** The earliest of them, a timed event before an all-day one. */
function firstOf(events: ReminderEvent[]): ReminderEvent {
  const timed = events.filter((event) => !event.allDay).sort(byStart);
  return timed[0] ?? [...events].sort(byStart)[0];
}

/** SPEC F3: a digest on each day that has events ("3 events today, first at 6:30 PM"). */
function digests(events: ReminderEvent[], settings: ReminderSettings): FireTime[] {
  const days = new Map<number, ReminderEvent[]>();
  for (const event of events) {
    // A timed event counts on the day it starts; an all-day one on each of its days.
    const last = event.allDay ? dayStart(event.endsAt - 1) : dayStart(event.startsAt);
    for (let n = 0, day = dayStart(event.startsAt); day <= last && n < MAX_DAYS; n++) {
      days.set(day, [...(days.get(day) ?? []), event]);
      day = dayStart(day, 1);
    }
  }
  return [...days].map(([day, onDay]) => ({
    id: `d:${dayKey(day)}`,
    eventId: null,
    kind: 'digest' as const,
    fireAt: atMinutes(day, settings.digestTime),
    title: `${plural(onDay.length)} today`,
    body: digestLine(onDay),
  }));
}

/** "First at 6:30 PM: Rooftop dinner", or with one event "Rooftop dinner at 6:30 PM". */
function digestLine(onDay: ReminderEvent[]): string {
  const first = firstOf(onDay);
  const when = first.allDay ? 'all day' : `at ${formatTime(first.startsAt)}`;
  if (onDay.length === 1) return `${first.title}${first.allDay ? ', ' : ' '}${when}`;
  return first.allDay ? `First: ${first.title}, all day` : `First ${when}: ${first.title}`;
}

/** SPEC F3: on Sunday, the week that starts the next morning, when it has events. */
function weeklyPreviews(events: ReminderEvent[], settings: ReminderSettings): FireTime[] {
  const weeks = new Map<number, ReminderEvent[]>();
  for (const event of events) {
    const day = dayStart(event.startsAt);
    const weekday = new Date(day).getDay();
    // Monday to Sunday is previewed by the Sunday before, so a Sunday event belongs
    // to the preview a week earlier.
    const sunday = dayStart(day, -(weekday === 0 ? 7 : weekday));
    weeks.set(sunday, [...(weeks.get(sunday) ?? []), event]);
  }
  return [...weeks].map(([sunday, inWeek]) => ({
    id: `w:${dayKey(sunday)}`,
    eventId: null,
    kind: 'weekly' as const,
    fireAt: atMinutes(sunday, settings.weeklyPreviewTime),
    title: `${plural(inWeek.length)} this coming week`,
    body: weekLine(inWeek),
  }));
}

/** "First: Rooftop dinner · Mon, Oct 12 · 6:30 PM". */
function weekLine(inWeek: ReminderEvent[]): string {
  const first = firstOf(inWeek);
  return `${inWeek.length === 1 ? '' : 'First: '}${first.title} · ${formatEventWhen(first)}`;
}

const dayKey = (day: number) => {
  const date = new Date(day);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

const soonestFirst = (a: FireTime, b: FireTime) => a.fireAt - b.fireAt || (a.id < b.id ? -1 : 1);

/**
 * Rule 1: every notification still to come, soonest first. An event its calendar no
 * longer has is not going ahead, so it reminds of nothing and counts in no digest.
 */
export function buildFireTimes(
  events: readonly ReminderEvent[],
  settings: ReminderSettings,
  now: number,
): FireTime[] {
  const live = events.filter((event) => !event.removedFromSource);
  return [
    ...live.flatMap((event) => eventReminders(event, settings)),
    ...(settings.digestEnabled ? digests(live, settings) : []),
    ...(settings.weeklyPreviewEnabled ? weeklyPreviews(live, settings) : []),
  ]
    .filter((fire) => fire.fireAt > now)
    .sort(soonestFirst);
}

/** Rule 2: only the nearest few are given to iOS. `sorted` is `buildFireTimes`' answer. */
export const nearest = (sorted: FireTime[], limit = MAX_SCHEDULED): FireTime[] =>
  sorted.slice(0, Math.max(0, limit));

export const signature = (fire: FireTime): string => `${fire.fireAt}|${fire.title}|${fire.body}`;

/**
 * Rule 4: what to do so that iOS holds exactly `wanted`. One that is already scheduled
 * with the same time and wording, and that iOS still holds, is left alone.
 */
export function diffSchedule(
  wanted: FireTime[],
  recorded: Recorded[],
  pending: Pending[],
): { keep: Recorded[]; add: FireTime[]; cancel: string[] } {
  const held = new Set(pending.map((p) => p.osNotificationId));
  const records = new Map(recorded.map((row) => [row.id, row]));
  const keep: Recorded[] = [];
  const add: FireTime[] = [];
  for (const fire of wanted) {
    const row = records.get(fire.id);
    if (row && row.signature === signature(fire) && held.has(row.osNotificationId)) keep.push(row);
    else add.push(fire);
  }
  const kept = new Set(keep.map((row) => row.osNotificationId));
  // Everything else of ours that iOS holds goes: reminders no longer wanted or about
  // to be replaced, and any the table lost track of (a crash between the two writes).
  // One that has already fired is no longer held, so there is nothing to cancel.
  const cancel = pending
    .filter((p) => p.ours && !p.test && !kept.has(p.osNotificationId))
    .map((p) => p.osNotificationId);
  return { keep, add, cancel };
}

/** The iPhone's side: what it holds, and adding to and taking from it. */
export type ReminderOs = {
  pending: () => Promise<Pending[]>;
  /** Resolves to the id iOS knows the notification by. */
  schedule: (fire: FireTime) => Promise<string>;
  cancel: (osNotificationId: string) => Promise<void>;
};

/** The ScheduledNotification table. */
export type ReminderStore = {
  list: () => Recorded[];
  replace: (rows: Recorded[]) => void;
};

export type ReconcileResult = {
  /** Every future fire time, before the cut to the nearest few. */
  planned: number;
  /** How many of ours iOS holds once this run is over. */
  scheduled: number;
  added: number;
  cancelled: number;
};

/**
 * One run of the scheduler. Safe to run as often as wanted: a second run straight
 * after the first does nothing. Without permission nothing is wanted, so anything
 * left over is cancelled.
 */
export async function reconcile(input: {
  events: readonly ReminderEvent[];
  settings: ReminderSettings;
  now: number;
  allowed: boolean;
  os: ReminderOs;
  store: ReminderStore;
  /** Slots to leave free, for a test notification about to be sent. */
  reserve?: number;
}): Promise<ReconcileResult> {
  const { os, store } = input;
  const all = input.allowed ? buildFireTimes(input.events, input.settings, input.now) : [];
  const pending = await os.pending();
  // A waiting test notification takes one of the 60 places.
  const tests = pending.filter((p) => p.ours && p.test).length;
  const wanted = nearest(all, MAX_SCHEDULED - Math.max(tests, input.reserve ?? 0));
  const { keep, add, cancel } = diffSchedule(wanted, store.list(), pending);

  // Cancelled first, so iOS never holds more than the limit, even for a moment.
  let cancelled = 0;
  for (const osNotificationId of cancel) {
    try {
      await os.cancel(osNotificationId);
      cancelled += 1;
    } catch {
      // Still held: the next run finds it again.
    }
  }
  const rows = [...keep];
  for (const fire of add) {
    try {
      const osNotificationId = await os.schedule(fire);
      const { id, eventId, kind, fireAt } = fire;
      rows.push({ id, eventId, kind, fireAt, osNotificationId, signature: signature(fire) });
    } catch {
      // Not scheduled, so not recorded: the next run tries it again.
    }
  }
  store.replace(rows);
  return { planned: all.length, scheduled: rows.length, added: rows.length - keep.length, cancelled };
}
