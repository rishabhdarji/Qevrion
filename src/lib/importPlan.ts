import type { ImportedEvent, ImportResult, ImportScope } from '../types';
import { dayStart } from './dates';
import { webLink } from './links';

// The rules of an import, worked out without a database: given what is stored and what
// a calendar or a file has just handed over, what to add, change, re-key and mark as
// gone. Pure, so the phone's database and the web preview's stand-in share it, and the
// rules are tested on their own.
//
// A calendar event's `sourceId` is "<calendarId>|<eventId>", with "|<start>" after it
// for one occurrence of a repeating event. An event from a file has its UID in place of
// the first two.

const DAY = 24 * 60 * 60 * 1000;

/** What the calendar owns. An import may overwrite these and nothing else. */
const OWNED = [
  'title',
  'startsAt',
  'endsAt',
  'allDay',
  'locationText',
  'host',
  'url',
  'description',
] as const satisfies readonly (keyof ImportedEvent)[];

/** A stored event of the source being imported. Deleted ones are included. */
export type ExistingEvent = ImportedEvent & {
  id: string;
  removedFromSource: boolean;
  /** The owner deleted it. It is kept only so that an import does not bring it back. */
  deleted: boolean;
};

export type ImportPlan = {
  inserts: ImportedEvent[];
  /** `relocate`: the address changed, so where it is has to be looked up again. */
  updates: { id: string; event: ImportedEvent; relocate: boolean }[];
  /** Rows that need nothing but their new key. */
  rekeys: { id: string; sourceId: string }[];
  /** Ids of rows the calendar no longer has. */
  removed: string[];
  result: ImportResult;
};

// A pair of surrogates (an emoji, say) is matched first and kept. Half of one on its
// own, or a control character other than a tab or a new line, is dropped: neither
// survives being stored on the phone (its SQLite ends text at a NUL), so an event
// holding one would look changed on every import, and a NUL in a key would let two
// different keys be stored as one.
const UNSTORABLE =
  /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u0000-\u0008\u000B-\u001F\u007F\uD800-\uDFFF]/g;
const storable = (value: string) => value.replace(UNSTORABLE, (found) => (found.length === 2 ? found : ''));

/** Text as it can be stored, cut to `max` characters. Anything that is not text is ''. */
const cut = (value: unknown, max: number) => (typeof value === 'string' ? storable(value.slice(0, max)) : '');

/**
 * A time the app can store and show: whole milliseconds, a couple of days inside what
 * a date can hold so that the day after it still exists.
 */
const isTime = (value: unknown) => Number.isInteger(value) && Math.abs(value as number) < 8.64e15 - 2 * DAY;

/**
 * Calendar text and files come from outside, so nothing in them is taken on trust:
 * every field is checked and cut to a sane length. Null for an event that cannot be used.
 */
function clean(event: ImportedEvent): ImportedEvent | null {
  const sourceId = typeof event.sourceId === 'string' ? storable(event.sourceId) : '';
  if (sourceId === '' || sourceId.length > 500) return null;
  if (!isTime(event.startsAt) || !isTime(event.endsAt)) return null;
  const allDay = event.allDay === true;
  // An all-day event is whole days, as the database keeps it, and at least one of
  // them: some calendars give the same date as its start and its end.
  const startsAt = allDay ? dayStart(event.startsAt) : event.startsAt;
  const endsAt = allDay ? Math.max(dayStart(event.endsAt), dayStart(startsAt, 1)) : event.endsAt;
  return {
    sourceId,
    title: cut(event.title, 500).trim() || 'Untitled event',
    startsAt,
    endsAt: Math.max(endsAt, startsAt),
    allDay,
    locationText: cut(event.locationText, 500),
    host: cut(event.host, 500),
    // Only a plain web link is kept, whole or not at all: the app offers to open it.
    url: webLink(event.url),
    description: cut(event.description, 20_000),
  };
}

/**
 * Decides what an import writes. `existing` is every stored event of `scope.source`,
 * deleted ones included, with times as the app holds them.
 */
export function planImport(
  existing: readonly ExistingEvent[],
  incoming: readonly ImportedEvent[],
  scope: ImportScope,
): ImportPlan {
  const result: ImportResult = { added: 0, updated: 0, unchanged: 0, skipped: 0 };
  const plan: ImportPlan = { inserts: [], updates: [], rekeys: [], removed: [], result };

  const events = new Map<string, ImportedEvent>();
  for (const raw of incoming) {
    const event = clean(raw);
    // The same key twice in one batch: the first one wins.
    if (!event || events.has(event.sourceId)) result.skipped++;
    else events.set(event.sourceId, event);
  }

  // Cleaned like the keys they are compared with.
  const present = new Set(scope.source === 'calendar' ? scope.present.map(storable) : []);
  const calendarIds = scope.source === 'calendar' ? scope.calendarIds.map(storable) : [];
  /** Whether a stored event came from a calendar this import read. Any event of a file did. */
  const wasRead = (row: ExistingEvent) =>
    scope.source !== 'calendar' || calendarIds.some((id) => row.sourceId.startsWith(`${id}|`));
  const byKey = new Map(existing.map((row) => [row.sourceId, row]));
  const matched = new Set<string>();

  for (const event of events.values()) {
    // By key first. Failing that, a stored event with the same title and start whose
    // own key the calendar no longer has: the same event under a new id. A row whose
    // key is still out there belongs to another event, however alike the two look; a
    // row from a calendar that was not read is not this calendar's to give away; and a
    // deleted row is only ever found by its own key, so it cannot take in a new event.
    // ponytail: an event added by hand and later imported from the calendar is not
    // merged with it; match across sources when that bites.
    // ponytail: one pass over the stored rows per unmatched event, fine for a few
    // thousand; index them by title and start if an import ever gets slow.
    const row =
      byKey.get(event.sourceId) ??
      existing.find(
        (candidate) =>
          candidate.title === event.title &&
          candidate.startsAt === event.startsAt &&
          candidate.allDay === event.allDay &&
          !candidate.deleted &&
          wasRead(candidate) &&
          !matched.has(candidate.id) &&
          !events.has(candidate.sourceId) &&
          !present.has(candidate.sourceId),
      );
    if (!row) {
      plan.inserts.push(event);
      result.added++;
      continue;
    }
    matched.add(row.id);

    if (row.deleted) {
      // The owner deleted it, so it stays deleted.
      result.skipped++;
    } else if (!row.removedFromSource && OWNED.every((key) => row[key] === event[key])) {
      result.unchanged++;
      if (row.sourceId !== event.sourceId) plan.rekeys.push({ id: row.id, sourceId: event.sourceId });
    } else {
      // Also clears "removed from calendar" and sets the key the event has now.
      plan.updates.push({ id: row.id, event, relocate: row.locationText !== event.locationText });
      result.updated++;
    }
  }

  if (scope.source === 'calendar') {
    const { from, to } = scope;
    plan.removed = existing
      .filter(
        (row) =>
          !row.deleted &&
          !row.removedFromSource &&
          !matched.has(row.id) &&
          !present.has(row.sourceId) &&
          // Only a calendar that was read can say an event is gone, and only for the
          // dates it was asked about. A day is kept back at each end, so an event
          // sliding out past the edge of the window is not taken for a removed one.
          wasRead(row) &&
          row.startsAt < to - DAY &&
          row.endsAt > from + DAY,
      )
      .map((row) => row.id);
  }

  return plan;
}
