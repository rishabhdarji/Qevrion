// Date helpers. Times are stored in UTC and shown in the device's own time zone and
// language, so no locale or zone is passed.

// Built once: making a formatter is far dearer than using one, and a list row needs
// several. They keep the zone they were made in; src/app/_layout.tsx reloads the app
// if the phone's zone changes.
const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const monthShortFormat = new Intl.DateTimeFormat(undefined, { month: 'short' });

/** "Tue, Oct 13" */
export const formatDay = (ms: number): string => dayFormat.format(ms);

/** "6:30 PM" */
export const formatTime = (ms: number): string => timeFormat.format(ms);

/** "November 2026" */
export const formatMonth = (ms: number): string => monthFormat.format(ms);

/** "Nov" */
export const formatMonthShort = (ms: number): string => monthShortFormat.format(ms);

type Timed = { startsAt: number; allDay: boolean };

/** "6:30 PM", or "All day". */
export function formatEventTime(event: Timed): string {
  return event.allDay ? 'All day' : formatTime(event.startsAt);
}

/** "Tue, Oct 13 · 6:30 PM", or "Tue, Oct 13 · All day". */
export function formatEventWhen(event: Timed): string {
  return `${formatDay(event.startsAt)} · ${formatEventTime(event)}`;
}

/** The first moment of a calendar day on this phone. `day` may run past the month's end. */
export function startOfDay(year: number, month: number, day: number): number {
  const date = new Date(year, month, day);
  // Where the clocks change at midnight that day has no 00:00, and the iPhone's
  // JavaScript engine answers 23:00 the day before (Hermes issues 1121 and 2159).
  // An hour later is the day's real first moment.
  if (date.getDate() !== new Date(year, month, day, 12).getDate()) {
    date.setTime(date.getTime() + 3_600_000);
  }
  return date.getTime();
}

/** The first moment of the day `ms` falls in, moved on by `addDays` calendar days. */
export function dayStart(ms: number, addDays = 0): number {
  const date = new Date(ms);
  return startOfDay(date.getFullYear(), date.getMonth(), date.getDate() + addDays);
}

// An all-day event is a calendar date, not a moment: 17 October is 17 October in every
// time zone. It is stored as midnight UTC on that date and turned into this phone's
// own day when read, so lists and countdowns can treat it like any other event.

/** A stored all-day date to the first moment of that date on this phone. */
export function allDayToLocal(utcMidnight: number): number {
  const date = new Date(utcMidnight);
  return startOfDay(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** The reverse: the calendar date `ms` falls on here, as midnight UTC. */
export function allDayToUtc(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}
