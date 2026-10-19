import type { ImportedEvent, ImportScope } from '../types';
import { startOfDay } from './dates';
import { planImport, type ExistingEvent } from './importPlan';

// Times here are plain numbers, or days built on the phone's own clock, so every
// expectation holds in any time zone.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const start = 400 * DAY;

const incoming = (sourceId: string, extra: Partial<ImportedEvent> = {}): ImportedEvent => ({
  sourceId,
  title: 'Dinner',
  startsAt: start,
  endsAt: start + 2 * HOUR,
  allDay: false,
  locationText: '14 Alder Row',
  host: 'Maya',
  url: null,
  description: '',
  ...extra,
});

/** The same event as it would be stored after an import. */
const stored = (sourceId: string, extra: Partial<ExistingEvent> = {}): ExistingEvent => ({
  ...incoming(sourceId),
  id: `row-${sourceId}`,
  removedFromSource: false,
  deleted: false,
  ...extra,
});

const ics: ImportScope = { source: 'ics' };

/** The calendar `home`, read from 30 days before the event to 30 days after it. */
const calendar = (present: string[], calendarIds = ['home']): ImportScope => ({
  source: 'calendar',
  calendarIds,
  from: start - 30 * DAY,
  to: start + 30 * DAY,
  present,
});

const nothing = { inserts: [], updates: [], rekeys: [], removed: [] };
const counts = (added: number, updated: number, unchanged: number, skipped: number) => ({
  added,
  updated,
  unchanged,
  skipped,
});

describe('what comes in is cleaned first', () => {
  const cleaned = (extra: Partial<ImportedEvent>) => planImport([], [incoming('a', extra)], ics).inserts[0];

  it('skips an event with no usable time or key', () => {
    const plan = planImport(
      [],
      [
        incoming('a', { startsAt: NaN }),
        incoming('b', { endsAt: Infinity }),
        incoming('c', { startsAt: '5' as unknown as number }),
        // Neither of these could be stored: half a millisecond, and past the last date there is.
        incoming('d', { startsAt: start + 0.5 }),
        incoming('e', { endsAt: 8.64e15 }),
        incoming(''),
      ],
      ics,
    );
    expect(plan).toEqual({ ...nothing, result: counts(0, 0, 0, 6) });
  });

  it('never lets an event end before it starts', () => {
    expect(cleaned({ endsAt: start - HOUR })).toMatchObject({ startsAt: start, endsAt: start });
  });

  it('keeps an all-day event to whole days, and to at least one', () => {
    const first = startOfDay(2026, 9, 31);
    const next = startOfDay(2026, 10, 1);
    // As some calendars give a single day: the same date, or its last second.
    expect(cleaned({ allDay: true, startsAt: first, endsAt: first })).toMatchObject({ startsAt: first, endsAt: next });
    expect(cleaned({ allDay: true, startsAt: first + 9 * HOUR, endsAt: next - 1000 })).toMatchObject({
      startsAt: first,
      endsAt: next,
    });
    const third = startOfDay(2026, 10, 2);
    expect(cleaned({ allDay: true, startsAt: first, endsAt: third })).toMatchObject({ startsAt: first, endsAt: third });
  });

  it('trims the title, and gives a name to an event without one', () => {
    expect(cleaned({ title: '  Late dinner \n' }).title).toBe('Late dinner');
    expect(cleaned({ title: '   ' }).title).toBe('Untitled event');
  });

  it('cuts long text down, never through the middle of an emoji', () => {
    const event = cleaned({
      title: 'a'.repeat(600),
      locationText: 'b'.repeat(600),
      host: 'c'.repeat(600),
      description: `${'d'.repeat(19_999)}🎉 and more`,
    });
    expect(event.title).toHaveLength(500);
    expect(event.locationText).toHaveLength(500);
    expect(event.host).toHaveLength(500);
    expect(event.description).toBe('d'.repeat(19_999));
    expect(cleaned({ description: `${'d'.repeat(19_998)}🎉 and more` }).description).toHaveLength(20_000);
  });

  it('keeps a plain web link and drops anything else', () => {
    expect(cleaned({ url: 'https://partiful.com/e/EXAMPLE123' }).url).toBe('https://partiful.com/e/EXAMPLE123');
    expect(cleaned({ url: 'HTTP://example.com/a' }).url).toBe('HTTP://example.com/a');
    expect(cleaned({ url: 'javascript:alert(1)' }).url).toBeNull();
    expect(cleaned({ url: 'example.com/a' }).url).toBeNull();
    expect(cleaned({ url: 'https://partiful.com@evil.example/e' }).url).toBeNull();
    expect(cleaned({ url: `https://example.com/${'a'.repeat(2000)}` }).url).toBeNull();
  });

  it('drops what text cannot be stored with, and keeps what it can', () => {
    const event = cleaned({
      sourceId: 'uid-1\u0000-two',
      title: 'Din\u0000ner\u0007 \uD83C party',
      host: 'Maya \uDFFF\u001F\u007FOkafor',
      description: 'Line one\r\nLine two\t\u00E9 \uD83C\uDF89',
    });
    expect(event).toMatchObject({
      sourceId: 'uid-1-two',
      title: 'Dinner  party',
      host: 'Maya Okafor',
      // Tabs and new lines stay, and so does a whole emoji.
      description: 'Line one\nLine two\t\u00E9 \uD83C\uDF89',
    });
  });

  it('skips an event whose key is too long, or nothing once cleaned', () => {
    const plan = planImport([], [incoming('k'.repeat(501)), incoming('\u0000\u0001'), incoming('k'.repeat(500))], ics);
    expect(plan.inserts.map((event) => event.sourceId)).toEqual(['k'.repeat(500)]);
    expect(plan.result).toEqual(counts(1, 0, 0, 2));
  });

  it('keeps two keys apart that differ only after a NUL', () => {
    const plan = planImport([], [incoming('uid\u0000a'), incoming('uid\u0000b', { title: 'Other' })], ics);
    expect(plan.inserts.map((event) => event.sourceId)).toEqual(['uida', 'uidb']);
  });

  it('reads anything that is not text as empty', () => {
    const blank = null as unknown as string;
    expect(cleaned({ title: blank, locationText: blank, host: blank, description: blank })).toMatchObject({
      title: 'Untitled event',
      locationText: '',
      host: '',
      description: '',
    });
  });

  it('takes the first of two events with the same key', () => {
    const plan = planImport([], [incoming('a'), incoming('a', { title: 'Twin' })], ics);
    expect(plan.inserts.map((event) => event.title)).toEqual(['Dinner']);
    expect(plan.result).toEqual(counts(1, 0, 0, 1));
  });
});

describe('matching what is stored', () => {
  it('adds an event it has not seen', () => {
    const plan = planImport([stored('a')], [incoming('b', { title: 'Lunch' })], ics);
    expect(plan).toEqual({
      ...nothing,
      inserts: [incoming('b', { title: 'Lunch' })],
      result: counts(1, 0, 0, 0),
    });
  });

  it('writes nothing when nothing changed', () => {
    expect(planImport([stored('a')], [incoming('a')], ics)).toEqual({
      ...nothing,
      result: counts(0, 0, 1, 0),
    });
  });

  it('updates what the calendar owns', () => {
    const later = incoming('a', { title: 'Late dinner', startsAt: start + HOUR, endsAt: start + 3 * HOUR });
    expect(planImport([stored('a')], [later], ics)).toEqual({
      ...nothing,
      updates: [{ id: 'row-a', event: later, relocate: false }],
      result: counts(0, 1, 0, 0),
    });
  });

  it('asks for the place to be found again only when the address changed', () => {
    const [update] = planImport([stored('a')], [incoming('a', { locationText: '9 Wren Street' })], ics).updates;
    expect(update.relocate).toBe(true);
  });

  it('finds an event whose key changed by its title and start, and only re-keys it', () => {
    expect(planImport([stored('old')], [incoming('new')], ics)).toEqual({
      ...nothing,
      rekeys: [{ id: 'row-old', sourceId: 'new' }],
      result: counts(0, 0, 1, 0),
    });
    // A changed field as well makes it an update, which carries the new key.
    const moved = incoming('new', { locationText: '9 Wren Street' });
    expect(planImport([stored('old')], [moved], ics)).toMatchObject({
      updates: [{ id: 'row-old', event: moved, relocate: true }],
      rekeys: [],
    });
  });

  it('falls back only on the same title, start and all-day setting', () => {
    for (const change of [{ title: 'Supper' }, { startsAt: start + 1 }, { allDay: true }]) {
      expect(planImport([stored('old')], [incoming('new', change)], ics).result).toEqual(counts(1, 0, 0, 0));
    }
  });

  it('keeps two events that look alike as two', () => {
    // Both in the batch: the second is new, however much it looks like the first.
    expect(planImport([stored('a')], [incoming('a'), incoming('b')], ics).result).toEqual(counts(1, 0, 1, 0));
    // The look-alike is still in the calendar but was filtered out of this batch.
    const plan = planImport([stored('home|1')], [incoming('home|2')], calendar(['home|1', 'home|2']));
    expect(plan).toMatchObject({ rekeys: [], removed: [], result: counts(1, 0, 0, 0) });
  });

  it('gives a stored event to one incoming event only', () => {
    const plan = planImport([stored('old')], [incoming('new-1'), incoming('new-2')], ics);
    expect(plan.rekeys).toEqual([{ id: 'row-old', sourceId: 'new-1' }]);
    expect(plan.inserts).toEqual([incoming('new-2')]);
  });

  it('keeps a deleted event deleted, whatever the calendar says now', () => {
    const gone = stored('a', { deleted: true });
    expect(planImport([gone], [incoming('a', { title: 'Back again' })], ics)).toEqual({
      ...nothing,
      result: counts(0, 0, 0, 1),
    });
  });

  it('never lets a deleted event take in a new one that looks like it', () => {
    expect(planImport([stored('a', { deleted: true })], [incoming('new')], ics)).toEqual({
      ...nothing,
      inserts: [incoming('new')],
      result: counts(1, 0, 0, 0),
    });
  });

  it('never gives the event of a calendar that was not read to one that was', () => {
    // Same title and start, in another calendar: the owner's notes stay where they are.
    const plan = planImport([stored('work|1')], [incoming('home|9')], calendar(['home|9']));
    expect(plan).toEqual({ ...nothing, inserts: [incoming('home|9')], result: counts(1, 0, 0, 0) });
    // Once both calendars are read, it is the same event under a new key.
    const both = planImport([stored('work|1')], [incoming('home|9')], calendar(['home|9'], ['home', 'work']));
    expect(both.rekeys).toEqual([{ id: 'row-work|1', sourceId: 'home|9' }]);
  });

  it('updates an event marked as removed that is back, so the mark is cleared', () => {
    const marked = stored('home|1', { removedFromSource: true });
    expect(planImport([marked], [incoming('home|1')], calendar(['home|1']))).toEqual({
      ...nothing,
      updates: [{ id: 'row-home|1', event: incoming('home|1'), relocate: false }],
      result: counts(0, 1, 0, 0),
    });
  });
});

describe('events gone from the calendar', () => {
  const removed = (row: ExistingEvent, scope = calendar([])) => planImport([row], [], scope).removed;

  it('marks a stored event the calendar no longer has', () => {
    expect(removed(stored('home|1'))).toEqual(['row-home|1']);
    expect(planImport([stored('home|1')], [], calendar([])).result).toEqual(counts(0, 0, 0, 0));
  });

  it('leaves an event that is still there, even when it was filtered out', () => {
    expect(removed(stored('home|1'), calendar(['home|1']))).toEqual([]);
  });

  it('leaves an event from a calendar that was not read', () => {
    expect(removed(stored('work|1'))).toEqual([]);
    // "home" is not "home-2": the whole calendar id has to match.
    expect(removed(stored('home-2|1'))).toEqual([]);
    expect(removed(stored('work|1'), calendar([], ['home', 'work']))).toEqual(['row-work|1']);
  });

  it('leaves an event outside the dates that were read, or within a day of their edge', () => {
    const at = (startsAt: number) => stored('home|1', { startsAt, endsAt: startsAt + 2 * HOUR });
    expect(removed(at(start + 31 * DAY))).toEqual([]);
    expect(removed(at(start - 31 * DAY))).toEqual([]);
    expect(removed(at(start + 29 * DAY))).toEqual([]);
    expect(removed(at(start - 29 * DAY - 2 * HOUR))).toEqual([]);
    expect(removed(at(start + 29 * DAY - 1))).toEqual(['row-home|1']);
    expect(removed(at(start - 29 * DAY - 2 * HOUR + 1))).toEqual(['row-home|1']);
  });

  it('leaves an event that is already marked, or that the owner deleted', () => {
    expect(removed(stored('home|1', { removedFromSource: true }))).toEqual([]);
    expect(removed(stored('home|1', { deleted: true }))).toEqual([]);
  });

  it('leaves an event that was matched under a new key', () => {
    const plan = planImport([stored('home|1')], [incoming('home|2')], calendar(['home|2']));
    expect(plan).toMatchObject({ rekeys: [{ id: 'row-home|1', sourceId: 'home|2' }], removed: [] });
  });

  it('never marks anything when the import is a file', () => {
    expect(planImport([stored('home|1')], [], ics).removed).toEqual([]);
  });
});
