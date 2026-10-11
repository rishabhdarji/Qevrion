import type { EventFields, QevrionEvent } from '../types';
import { dayStart } from './dates';

// What the add/edit form holds while it is open, and the rules for saving it. Pure,
// so the rules are tested without a screen.

export type EventDraft = {
  title: string;
  allDay: boolean;
  /** A moment in time. When `allDay` is on, only its calendar day counts. */
  start: number;
  /** For an all-day draft, any moment on the last day (inclusive). */
  end: number;
  locationText: string;
  host: string;
  url: string;
  notes: string;
};

export type DraftErrors = { title?: string; start?: string; end?: string };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** An empty form: starts at the next full hour and runs two hours. */
export function newDraft(now: number): EventDraft {
  // On the phone's own clock: some zones sit half an hour off UTC.
  const start = new Date(now).setHours(new Date(now).getHours() + 1, 0, 0, 0);
  return {
    title: '',
    allDay: false,
    start,
    end: start + 2 * HOUR,
    locationText: '',
    host: '',
    url: '',
    notes: '',
  };
}

export function eventToDraft(event: QevrionEvent): EventDraft {
  return {
    title: event.title,
    allDay: event.allDay,
    start: event.startsAt,
    // An all-day event ends at the start of the day after its last day.
    end: event.allDay ? dayStart(event.endsAt - 1) : event.endsAt,
    locationText: event.locationText,
    host: event.host,
    url: event.url ?? '',
    notes: event.notes,
  };
}

/** Moves the start and carries the end with it, so the event keeps its length. */
export function moveStart(draft: EventDraft, start: number): EventDraft {
  if (!draft.allDay) return { ...draft, start, end: start + (draft.end - draft.start) };
  // Whole calendar days: a day is 23 or 25 hours long when the clocks change.
  const days = Math.round((dayStart(start) - dayStart(draft.start)) / DAY);
  return { ...draft, start, end: dayStart(draft.end, days) };
}

export function validateDraft(draft: EventDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.title.trim() === '') errors.title = 'Give the event a title.';
  if (!Number.isFinite(draft.start)) errors.start = 'Pick when it starts.';
  if (draft.allDay) {
    if (dayStart(draft.end) < dayStart(draft.start)) {
      errors.end = 'The last day cannot be before the first.';
    }
  } else if (!(draft.end > draft.start)) {
    errors.end = 'The end has to be after the start.';
  }
  return errors;
}

/** The draft as it is saved. Call only when `validateDraft` finds nothing. */
export function draftToFields(draft: EventDraft): EventFields {
  const url = draft.url.trim();
  return {
    title: draft.title.trim(),
    allDay: draft.allDay,
    startsAt: draft.allDay ? dayStart(draft.start) : draft.start,
    endsAt: draft.allDay ? dayStart(draft.end, 1) : draft.end,
    locationText: draft.locationText.trim(),
    host: draft.host.trim(),
    // "partiful.com/e/abc" is a link someone meant to be tappable.
    url: url === '' ? null : /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`,
    notes: draft.notes.trim(),
  };
}
