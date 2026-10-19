import { findConflicts } from '../lib/conflicts';
import { startOfDay } from '../lib/dates';
import type { EventFields, ImportedEvent } from '../types';
import {
  deleteAllData,
  deleteEvent,
  deleteSampleEvents,
  findRoute,
  getSettings,
  importEvents,
  keepRoute,
  listEvents,
  MIGRATIONS,
  nextPendingAddress,
  replaceSampleEvents,
  saveEvent,
  setGeocode,
  updateSettings,
} from './db';
import { makeSampleEvents, SAMPLE_COUNT } from './sampleEvents';

// The real SQL runs here, against the SQLite built into Node standing in for the
// phone's. A mistake in the schema or a query fails this file instead of the app.
jest.mock('expo-sqlite', () => jest.requireActual('./sqlite.testing'));

type Database = ReturnType<typeof import('./sqlite.testing').newDatabase>;
const shared = globalThis as { testDatabase?: Database };

/** Every stored row as it is, for what no screen reads yet and for rows kept out of sight. */
const rows = () =>
  shared.testDatabase!.prepare('SELECT * FROM events ORDER BY title').all() as Record<string, unknown>[];

/** Hands a database to a fresh copy of the module, as the next launch would. */
function launchWith(database: Database, check: (launched: typeof import('./db')) => void) {
  const current = shared.testDatabase;
  shared.testDatabase = database;
  try {
    let launched!: typeof import('./db');
    jest.isolateModules(() => {
      launched = jest.requireActual('./db');
    });
    check(launched);
  } finally {
    shared.testDatabase = current;
  }
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const evening = new Date(2026, 9, 17, 19).getTime();

const dinner: EventFields = {
  title: 'Dinner',
  startsAt: evening,
  endsAt: evening + 2 * HOUR,
  allDay: false,
  locationText: '14 Alder Row',
  host: 'Maya',
  url: null,
  notes: 'Bring wine',
};

/** The same dinner as a calendar would hand it over. */
const invite: ImportedEvent = {
  sourceId: 'home|1',
  title: 'Dinner',
  startsAt: evening,
  endsAt: evening + 2 * HOUR,
  allDay: false,
  locationText: '14 Alder Row',
  host: 'Maya',
  url: null,
  description: 'Doors at seven.',
};

const counts = (added: number, updated: number, unchanged: number, skipped: number) => ({
  added,
  updated,
  unchanged,
  skipped,
});

/**
 * A sync of the calendar `home`, read from a month before the dinner to a year after.
 * Unless told otherwise, what is handed over is all the calendar has.
 */
const sync = (
  events: ImportedEvent[],
  present = events.map((event) => event.sourceId),
  calendarIds = ['home'],
) =>
  importEvents(events, {
    source: 'calendar',
    calendarIds,
    from: evening - 30 * DAY,
    to: evening + 365 * DAY,
    present,
  });

const titled = (title: string) => listEvents().find((event) => event.title === title)!;

beforeEach(deleteAllData);

describe('events', () => {
  it('starts empty', () => {
    expect(listEvents()).toEqual([]);
  });

  it('gives back what was saved, with an id of its own', () => {
    saveEvent(dinner);
    const [saved] = listEvents();
    expect(saved).toMatchObject({ ...dinner, source: 'manual', sourceId: null });
    expect(saved).toMatchObject({ description: '', keyDetails: [], isPartiful: false });
    expect(saved.id).toMatch(/^[0-9a-f]{32}$/);

    saveEvent(dinner);
    const ids = listEvents().map((event) => event.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('keeps an all-day event on the same days', () => {
    const festival = {
      ...dinner,
      allDay: true,
      startsAt: startOfDay(2026, 9, 31),
      endsAt: startOfDay(2026, 10, 2),
    };
    saveEvent(festival);
    expect(listEvents()[0]).toMatchObject(festival);
  });

  it('updates the form fields and leaves the rest alone', () => {
    saveEvent({
      ...dinner,
      sourceId: 'sample:1',
      description: 'Tickets at partiful.com/e/abc',
      keyDetails: ['Smart casual'],
    });
    const { id } = listEvents()[0];

    saveEvent({ ...dinner, title: 'Late dinner', startsAt: evening + HOUR, endsAt: evening + 4 * HOUR }, id);

    const events = listEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id,
      title: 'Late dinner',
      startsAt: evening + HOUR,
      sourceId: 'sample:1',
      description: 'Tickets at partiful.com/e/abc',
      keyDetails: ['Smart casual'],
      // The link in the description still makes it a Partiful event.
      isPartiful: true,
    });
  });

  it('spots a Partiful link, and forgets it when the link goes', () => {
    saveEvent({ ...dinner, url: 'https://partiful.com/e/abc' });
    const [event] = listEvents();
    expect(event.isPartiful).toBe(true);

    saveEvent(dinner, event.id);
    expect(listEvents()[0].isPartiful).toBe(false);
  });

  it('keeps the name of a photo, changes it, and clears it', () => {
    saveEvent(dinner);
    const { id, photo } = listEvents()[0];
    expect(photo).toBeNull();

    saveEvent({ ...dinner, photo: 'first.jpg' }, id);
    expect(listEvents()[0].photo).toBe('first.jpg');
    saveEvent({ ...dinner, photo: 'second.jpg' }, id);
    expect(listEvents()[0].photo).toBe('second.jpg');
    saveEvent({ ...dinner, photo: null }, id);
    expect(listEvents()[0].photo).toBeNull();
  });

  it('deletes one event and only that one', () => {
    saveEvent(dinner);
    saveEvent({ ...dinner, title: 'Lunch' });
    const lunch = listEvents().find((event) => event.title === 'Lunch');
    deleteEvent(lunch!.id);
    expect(listEvents().map((event) => event.title)).toEqual(['Dinner']);
  });

  it('refuses an event that ends before it starts', () => {
    expect(() => saveEvent({ ...dinner, endsAt: evening - HOUR })).toThrow();
    expect(listEvents()).toEqual([]);
  });
});

describe('importing', () => {
  const picnic: ImportedEvent = {
    ...invite,
    sourceId: 'home|2',
    title: 'Picnic',
    startsAt: evening + 3 * DAY,
    endsAt: evening + 3 * DAY + HOUR,
    locationText: 'Community Garden Hall',
    url: 'https://partiful.com/e/EXAMPLE123',
    // Longer than is kept, with an emoji sitting on the cut.
    description: `${'d'.repeat(19_999)}🎉🎉`,
  };

  it('adds what is new, and nothing the second time', () => {
    expect(sync([invite, picnic])).toMatchObject(counts(2, 0, 0, 0));
    expect(sync([invite, picnic])).toMatchObject(counts(0, 0, 2, 0));
    expect(listEvents()).toHaveLength(2);

    expect(titled('Dinner')).toMatchObject({
      ...invite,
      source: 'calendar',
      isPartiful: false,
      notes: '',
      keyDetails: [],
      photo: null,
      lat: null,
      lng: null,
      geocodeStatus: 'pending',
      removedFromSource: false,
    });
    expect(titled('Dinner').id).toMatch(/^[0-9a-f]{32}$/);
    expect(titled('Picnic')).toMatchObject({ isPartiful: true, description: 'd'.repeat(19_999) });
  });

  it('changes what the calendar owns and nothing the owner added', () => {
    sync([invite]);
    const { id } = listEvents()[0];
    saveEvent({ ...dinner, notes: 'Bring wine', photo: 'mine.jpg' }, id);
    // No screen writes these yet, so they are put in underneath.
    shared.testDatabase!.exec(
      `UPDATE events SET checklist = '["Wine"]', tags = '["friends"]', reminderOffsets = '[60]',
        keyDetails = '["Smart casual"]'`,
    );
    const [before] = rows();

    const changed = {
      ...invite,
      title: 'Late dinner',
      startsAt: evening + HOUR,
      endsAt: evening + 4 * HOUR,
      host: 'Maya Okafor',
      url: 'https://partiful.com/e/EXAMPLE123',
      description: 'Doors at eight.',
    };
    expect(sync([changed])).toMatchObject(counts(0, 1, 0, 0));

    expect(listEvents()).toHaveLength(1);
    expect(listEvents()[0]).toMatchObject({ ...changed, id, isPartiful: true, notes: 'Bring wine', photo: 'mine.jpg' });
    expect(rows()[0]).toMatchObject({
      checklist: before.checklist,
      tags: before.tags,
      reminderOffsets: before.reminderOffsets,
      keyDetails: before.keyDetails,
      createdAt: before.createdAt,
    });
  });

  it('follows an event to a new key by its title and start', () => {
    sync([invite]);
    const { id } = listEvents()[0];
    saveEvent({ ...dinner, notes: 'Bring wine' }, id);

    const rekeyed = { ...invite, sourceId: 'home|9' };
    expect(sync([rekeyed])).toMatchObject(counts(0, 0, 1, 0));
    expect(listEvents()).toMatchObject([{ id, sourceId: 'home|9', notes: 'Bring wine', removedFromSource: false }]);
    expect(sync([rekeyed])).toMatchObject(counts(0, 0, 1, 0));
  });

  it('keeps two different events with the same title and start as two', () => {
    const twin = { ...invite, sourceId: 'home|2' };
    expect(sync([invite, twin])).toMatchObject(counts(2, 0, 0, 0));
    expect(sync([invite, twin])).toMatchObject(counts(0, 0, 2, 0));
    // One of them filtered out of the batch, then back.
    expect(sync([twin], ['home|1', 'home|2'])).toMatchObject(counts(0, 0, 1, 0));
    expect(sync([invite, twin])).toMatchObject(counts(0, 0, 2, 0));
    expect(listEvents().map((event) => event.sourceId).sort()).toEqual(['home|1', 'home|2']);
  });

  it('keeps the same key from a calendar and from a file apart', () => {
    sync([invite]);
    expect(importEvents([invite], { source: 'ics' })).toMatchObject(counts(1, 0, 0, 0));
    expect(listEvents().map((event) => event.source).sort()).toEqual(['calendar', 'ics']);
  });

  it('marks an event that is gone from the calendar, and clears the mark when it is back', () => {
    sync([invite]);
    expect(sync([])).toMatchObject(counts(0, 0, 0, 0));
    expect(listEvents()).toMatchObject([{ title: 'Dinner', removedFromSource: true }]);

    expect(sync([invite])).toMatchObject(counts(0, 1, 0, 0));
    expect(listEvents()).toMatchObject([{ title: 'Dinner', removedFromSource: false }]);
  });

  it('does not call an event gone when it cannot tell', () => {
    const outside = { ...invite, sourceId: 'home|far', title: 'Next winter', startsAt: evening + 400 * DAY, endsAt: evening + 401 * DAY };
    const unread = { ...invite, sourceId: 'work|1', title: 'Team lunch' };
    const filtered = { ...invite, sourceId: 'home|3', title: 'Quiet night' };
    sync([invite, outside, unread, filtered], undefined, ['home', 'work']);

    // Only `home` is read this time, and it still has the event that was filtered out.
    sync([], ['home|3']);

    expect(Object.fromEntries(listEvents().map((event) => [event.title, event.removedFromSource]))).toEqual({
      Dinner: true,
      'Next winter': false,
      'Team lunch': false,
      'Quiet night': false,
    });
  });

  it('never calls anything gone when the import is a file', () => {
    importEvents([invite, picnic], { source: 'ics' });
    expect(importEvents([], { source: 'ics' })).toMatchObject(counts(0, 0, 0, 0));
    expect(listEvents().map((event) => event.removedFromSource)).toEqual([false, false]);
  });

  it('keeps a deleted import deleted, and really deletes an event added by hand', () => {
    sync([{ ...invite, url: 'https://partiful.com/e/EXAMPLE123' }]);
    saveEvent({ ...dinner, title: 'Lunch' });
    saveEvent({ ...dinner, url: 'https://partiful.com/e/EXAMPLE123', photo: 'mine.jpg' }, titled('Dinner').id);
    setGeocode(invite.locationText, { lat: 51.5, lng: -0.12 });
    shared.testDatabase!.exec(
      `UPDATE events SET checklist = '["Wine"]', tags = '["friends"]', reminderOffsets = '[60]',
        keyDetails = '["Smart casual"]'`,
    );
    const [before] = rows().filter((row) => row.title === 'Dinner');

    deleteEvent(titled('Lunch').id);
    deleteEvent(titled('Dinner').id);
    expect(listEvents()).toEqual([]);
    // The import is still stored, out of sight, with nothing kept but what tells it apart.
    expect(rows()).toEqual([
      {
        ...before,
        deletedAt: expect.any(Number),
        description: '',
        locationText: '',
        host: '',
        url: null,
        photo: null,
        notes: '',
        lat: null,
        lng: null,
        geocodeStatus: 'pending',
        isPartiful: 0,
        tags: '[]',
        checklist: '[]',
        keyDetails: '[]',
        reminderOffsets: null,
      },
    ]);
    expect(before).toMatchObject({ notes: 'Bring wine', photo: 'mine.jpg', geocodeStatus: 'located', isPartiful: 1 });

    expect(sync([{ ...invite, title: 'Dinner, moved' }])).toMatchObject(counts(0, 0, 0, 1));
    expect(sync([])).toMatchObject(counts(0, 0, 0, 0));
    expect(listEvents()).toEqual([]);
    expect(rows()).toMatchObject([{ title: 'Dinner', removedFromSource: 0 }]);

    deleteAllData();
    expect(rows()).toEqual([]);
  });

  it('never lets a deleted import take in a new event that looks like it', () => {
    sync([invite]);
    deleteEvent(listEvents()[0].id);
    expect(sync([{ ...invite, sourceId: 'home|2' }])).toMatchObject(counts(1, 0, 0, 0));
    expect(listEvents()).toMatchObject([{ sourceId: 'home|2', title: 'Dinner' }]);
  });

  it('leaves an event from a calendar that was not read with its own notes', () => {
    sync([{ ...invite, sourceId: 'work|1' }], undefined, ['work']);
    saveEvent({ ...dinner, notes: 'Bring wine' }, listEvents()[0].id);

    // The same title and start turn up in another calendar.
    expect(sync([{ ...invite, sourceId: 'home|9' }])).toMatchObject(counts(1, 0, 0, 0));
    expect(listEvents().map(({ sourceId, notes }) => ({ sourceId, notes })).sort((a, b) => (a.sourceId! < b.sourceId! ? -1 : 1))).toEqual([
      { sourceId: 'home|9', notes: '' },
      { sourceId: 'work|1', notes: 'Bring wine' },
    ]);
  });

  it('stores text without what the phone cannot keep, so it comes back unchanged', () => {
    const odd: ImportedEvent = {
      ...invite,
      sourceId: 'home|odd\u0000one',
      title: 'Din\u0000ner\uD83C party\u0007',
      description: 'Doors at seven.\r\nUpstairs \uDFFF\uD83C\uDF89',
      host: 'Maya\u001F',
    };
    // A second key that only differs after a NUL, as the phone would cut it.
    const twin = { ...odd, sourceId: 'home|odd\u0000two', title: 'Twin' };
    expect(sync([odd, twin])).toMatchObject(counts(2, 0, 0, 0));
    expect(sync([odd, twin])).toMatchObject(counts(0, 0, 2, 0));
    expect(titled('Dinner party')).toMatchObject({
      sourceId: 'home|oddone',
      description: 'Doors at seven.\nUpstairs \uD83C\uDF89',
      host: 'Maya',
    });
    expect(titled('Twin').sourceId).toBe('home|oddtwo');
  });

  it('finds all-day events unchanged when they come in again, every day of the year', () => {
    // Each zone's clock-change days are in here; `npm run test:zones` runs six.
    const days = Array.from(
      { length: 365 },
      (_, day): ImportedEvent => ({
        ...invite,
        sourceId: `day-${day}`,
        title: `Day ${day}`,
        allDay: true,
        startsAt: startOfDay(2026, 0, 1 + day),
        endsAt: startOfDay(2026, 0, 2 + day + (day % 3)),
      }),
    );
    expect(importEvents(days, { source: 'ics' })).toMatchObject(counts(365, 0, 0, 0));
    expect(importEvents(days, { source: 'ics' })).toMatchObject(counts(0, 0, 365, 0));
    expect(titled('Day 304')).toMatchObject({ allDay: true, startsAt: days[304].startsAt, endsAt: days[304].endsAt });
  });

  it('saves all of an import or none of it', () => {
    sync([invite]);
    // The last thing this sync does is mark the dinner as gone. Make that step fail,
    // after the picnic has been added.
    const database = shared.testDatabase!;
    const prepare = database.prepare.bind(database);
    database.prepare = (sql) => {
      if (sql.includes('removedFromSource = 1')) throw new Error('The disk is full');
      return prepare(sql);
    };
    try {
      expect(() => sync([picnic])).toThrow('The disk is full');
    } finally {
      database.prepare = prepare;
    }
    expect(listEvents()).toMatchObject([{ title: 'Dinner', removedFromSource: false }]);
  });
});

describe('where an event is', () => {
  const now = evening - 2 * DAY;
  const place = { lat: 51.5, lng: -0.12 };
  const at = (title: string, locationText: string, startsAt = evening): EventFields => ({
    ...dinner,
    title,
    locationText,
    startsAt,
    endsAt: startsAt + 2 * HOUR,
  });

  it('gives one answer to every event waiting on that address', () => {
    saveEvent(at('Dinner', '14 Alder Row'));
    saveEvent(at('Drinks', '14 Alder Row', evening + 3 * HOUR));
    saveEvent(at('Brunch', 'Table and Vine', evening + DAY));

    expect(nextPendingAddress(now)).toEqual({ address: '14 Alder Row', reused: 0 });
    setGeocode('14 Alder Row', place);
    expect(titled('Dinner')).toMatchObject({ ...place, geocodeStatus: 'located' });
    expect(titled('Drinks')).toMatchObject({ ...place, geocodeStatus: 'located' });
    expect(titled('Brunch')).toMatchObject({ lat: null, lng: null, geocodeStatus: 'pending' });

    expect(nextPendingAddress(now)).toEqual({ address: 'Table and Vine', reused: 0 });
    setGeocode('Table and Vine', null);
    expect(titled('Brunch')).toMatchObject({ lat: null, lng: null, geocodeStatus: 'notFound' });
    expect(nextPendingAddress(now)).toEqual({ address: null, reused: 0 });
  });

  it('keeps the place of an address picked from the suggestions, and never looks it up', () => {
    saveEvent({ ...at('Dinner', '350 5th Avenue, New York'), place: { lat: 40.7484, lng: -73.9857 } });
    expect(titled('Dinner')).toMatchObject({ lat: 40.7484, lng: -73.9857, geocodeStatus: 'located' });
    expect(nextPendingAddress(now).address).toBeNull();
  });

  it('takes a newly picked place over the one found before, and keeps it while the address stays', () => {
    saveEvent(at('Dinner', '14 Alder Row'));
    setGeocode('14 Alder Row', place);
    const { id } = titled('Dinner');
    saveEvent({ ...at('Dinner', '15 Alder Row'), place: { lat: 51.6, lng: -0.13 } }, id);
    expect(titled('Dinner')).toMatchObject({ lat: 51.6, lng: -0.13, geocodeStatus: 'located' });
    // Saved again without picking: the place stays with the unchanged address.
    saveEvent({ ...at('Dinner', '15 Alder Row'), notes: 'Changed' }, id);
    expect(titled('Dinner')).toMatchObject({ lat: 51.6, lng: -0.13, geocodeStatus: 'located' });
    // Typed over: looked up again.
    saveEvent(at('Dinner', '16 Alder Row'), id);
    expect(titled('Dinner')).toMatchObject({ lat: null, lng: null, geocodeStatus: 'pending' });
  });

  it('ignores a picked place that is off the map', () => {
    saveEvent({ ...at('Dinner', 'Nowhere'), place: { lat: 95, lng: 0 } });
    expect(titled('Dinner')).toMatchObject({ lat: null, geocodeStatus: 'pending' });
  });

  it('offers only events still to come, the soonest first', () => {
    saveEvent(at('Last week', 'Station Square', now - 7 * DAY));
    saveEvent(at('Next month', 'Harbour Print Studio', now + 30 * DAY));
    saveEvent(at('Tomorrow', 'Table and Vine', now + DAY));
    saveEvent(at('Yesterday', 'Canal Bridge steps', now - DAY));

    const offered: string[] = [];
    for (let next = nextPendingAddress(now).address; next !== null; next = nextPendingAddress(now).address) {
      offered.push(next);
      setGeocode(next, null);
    }
    expect(offered).toEqual(['Table and Vine', 'Harbour Print Studio']);
  });

  it('never offers a sample event, an empty address, a deleted or a removed event', () => {
    replaceSampleEvents(makeSampleEvents(now));
    saveEvent(at('Somewhere', ''));
    saveEvent(at('Nowhere', '   '));
    sync([invite]);
    deleteEvent(titled('Dinner').id);
    sync([{ ...invite, sourceId: 'home|2', title: 'Picnic', locationText: 'Canal Bridge steps' }]);
    sync([], []);
    expect(titled('Picnic').removedFromSource).toBe(true);
    expect(nextPendingAddress(now)).toEqual({ address: null, reused: 0 });

    // An imported event is offered even when its key reads like a sample's.
    importEvents([{ ...invite, sourceId: 'sample:1', locationText: 'Station Square' }], { source: 'ics' });
    expect(nextPendingAddress(now).address).toBe('Station Square');
  });

  it('reuses the answer for an address it has seen, without asking again', () => {
    saveEvent(at('Dinner', '14 Alder Row'));
    saveEvent(at('Brunch', 'Table and Vine'));
    setGeocode('14 Alder Row', place);
    setGeocode('Table and Vine', null);

    saveEvent(at('Drinks', '14 Alder Row'));
    sync([{ ...invite, title: 'Supper', locationText: 'Table and Vine' }]);
    expect(titled('Drinks').geocodeStatus).toBe('pending');

    expect(nextPendingAddress(now)).toEqual({ address: null, reused: 2 });
    expect(titled('Drinks')).toMatchObject({ ...place, geocodeStatus: 'located' });
    expect(titled('Supper')).toMatchObject({ lat: null, lng: null, geocodeStatus: 'notFound' });
    expect(nextPendingAddress(now)).toEqual({ address: null, reused: 0 });
  });

  it('looks again when the form changes the address, and not when it leaves it', () => {
    saveEvent(at('Dinner', '14 Alder Row'));
    const { id } = listEvents()[0];
    setGeocode('14 Alder Row', place);

    saveEvent(at('Late dinner', '14 Alder Row', evening + HOUR), id);
    expect(listEvents()[0]).toMatchObject({ title: 'Late dinner', ...place, geocodeStatus: 'located' });

    saveEvent(at('Late dinner', '9 Wren Street'), id);
    expect(listEvents()[0]).toMatchObject({ lat: null, lng: null, geocodeStatus: 'pending' });
    expect(nextPendingAddress(now).address).toBe('9 Wren Street');
  });

  it('looks again when a sync changes the address, and not when it leaves it', () => {
    sync([invite]);
    setGeocode(invite.locationText, place);

    sync([{ ...invite, title: 'Late dinner' }]);
    expect(listEvents()[0]).toMatchObject({ title: 'Late dinner', ...place, geocodeStatus: 'located' });

    sync([{ ...invite, locationText: '9 Wren Street' }]);
    expect(listEvents()[0]).toMatchObject({ lat: null, lng: null, geocodeStatus: 'pending' });
  });

  it('counts a place that is off the map as not found', () => {
    saveEvent(at('Dinner', '14 Alder Row'));
    setGeocode('14 Alder Row', { lat: 91, lng: 0 });
    expect(listEvents()[0]).toMatchObject({ lat: null, lng: null, geocodeStatus: 'notFound' });

    saveEvent(at('Brunch', 'Table and Vine'));
    setGeocode('Table and Vine', { lat: NaN, lng: 0 });
    expect(titled('Brunch')).toMatchObject({ lat: null, lng: null, geocodeStatus: 'notFound' });
  });
});

describe('sample events', () => {
  const now = new Date(2026, 9, 10, 12).getTime();
  const samples = makeSampleEvents(now);

  it('makes 120 different events around now, the same way every time', () => {
    expect(samples).toHaveLength(SAMPLE_COUNT);
    expect(SAMPLE_COUNT).toBe(120);
    expect(makeSampleEvents(now)).toEqual(samples);
    expect(new Set(samples.map((sample) => sample.sourceId)).size).toBe(120);
    expect(new Set(samples.map((sample) => sample.title)).size).toBe(120);
    expect(samples.every((sample) => sample.endsAt > sample.startsAt)).toBe(true);
  });

  it('covers what the app has to cope with', () => {
    const count = (test: (sample: EventFields) => boolean) => samples.filter(test).length;
    expect(count((sample) => sample.endsAt <= now)).toBeGreaterThanOrEqual(25);
    expect(count((sample) => sample.startsAt > now)).toBeGreaterThanOrEqual(80);
    expect(count((sample) => sample.startsAt <= now && sample.endsAt > now)).toBeGreaterThanOrEqual(2);
    expect(count((sample) => sample.allDay)).toBe(3);
    expect(count((sample) => sample.locationText === '')).toBe(1);
    expect(count((sample) => sample.url !== null)).toBeGreaterThan(30);
    // Two start within minutes, so the hero can be watched rolling over.
    expect(count((sample) => sample.startsAt > now && sample.startsAt <= now + 5 * 60_000)).toBe(2);
    const conflicts = findConflicts(samples.map((sample) => ({ ...sample, id: sample.sourceId! })));
    expect(conflicts.size).toBeGreaterThan(4);
  });

  it('replaces the old set instead of adding to it, and leaves real events alone', () => {
    saveEvent(dinner);
    replaceSampleEvents(samples);
    replaceSampleEvents(makeSampleEvents(now + HOUR));
    expect(listEvents()).toHaveLength(121);

    deleteSampleEvents();
    expect(listEvents().map((event) => event.title)).toEqual(['Dinner']);
  });

  it('leaves an imported event alone, even one whose key reads like a sample', () => {
    importEvents([{ ...invite, sourceId: 'sample:1' }], { source: 'ics' });
    replaceSampleEvents(samples);
    deleteSampleEvents();
    expect(listEvents()).toMatchObject([{ source: 'ics', sourceId: 'sample:1' }]);
  });
});

describe('settings', () => {
  it('starts with the defaults from the spec', () => {
    expect(getSettings()).toEqual({
      defaultOffsets: [1440, 120, 30],
      digestEnabled: true,
      digestTime: 480,
      weeklyPreviewEnabled: true,
      importCalendarIds: [],
      onlyPartifulLinks: false,
      units: 'mi',
      onboardingDone: false,
    });
  });

  it('changes only what it is given', () => {
    updateSettings({ onboardingDone: true, units: 'km', defaultOffsets: [60], digestEnabled: false });
    expect(getSettings()).toMatchObject({
      onboardingDone: true,
      units: 'km',
      defaultOffsets: [60],
      digestEnabled: false,
      weeklyPreviewEnabled: true,
    });
  });
});

describe('saved walking routes', () => {
  const from = { lat: 40.7484, lng: -73.9857 };
  const to = { lat: 40.7536, lng: -73.9832 };
  const now = evening;
  /** About this many metres north of a point. */
  const north = (p: { lat: number; lng: number }, metres: number) => ({ ...p, lat: p.lat + metres / 111_195 });
  const route = (fetchedAt = now, start = from, end = to) => ({
    from: start,
    to: end,
    line: [start, { lat: 40.751, lng: -73.984 }, end],
    distance: 650,
    duration: 470,
    steps: [{ instruction: 'Head north on 5th Avenue', distance: 300, duration: 216, start: 0 }],
    fetchedAt,
  });

  it('gives back a kept route, line and turns, for the same walk', () => {
    keepRoute(route());
    expect(findRoute(from, to, now + HOUR)).toEqual(route());
  });

  it('fits a start a little way off, but not one further away or another venue', () => {
    keepRoute(route());
    expect(findRoute(north(from, 60), to, now)).not.toBeNull();
    expect(findRoute(north(from, 120), to, now)).toBeNull();
    expect(findRoute(from, north(to, 60), now)).toBeNull();
  });

  it('lets a route go after two weeks', () => {
    keepRoute(route());
    expect(findRoute(from, to, now + 13 * DAY)).not.toBeNull();
    expect(findRoute(from, to, now + 15 * DAY)).toBeNull();
  });

  it('gives the newest when two fit, and keeps no more than forty', () => {
    keepRoute({ ...route(now), distance: 700 });
    keepRoute({ ...route(now + 1), distance: 650 });
    expect(findRoute(from, to, now + 2)?.distance).toBe(650);
    for (let i = 0; i < 45; i++) keepRoute(route(now + 10 + i, north(from, 500 * (i + 1))));
    const kept = shared.testDatabase!.prepare('SELECT count(*) AS n FROM routes').get() as { n: number };
    expect(kept.n).toBe(40);
  });

  it('goes with Delete all data', () => {
    keepRoute(route());
    deleteAllData();
    expect(findRoute(from, to, now)).toBeNull();
  });
});

const { newDatabase } = jest.requireActual<typeof import('./sqlite.testing')>('./sqlite.testing');

describe('the database file', () => {
  it('is wiped by Delete all data, settings included', () => {
    saveEvent(dinner);
    updateSettings({ onboardingDone: true });
    deleteAllData();
    expect(listEvents()).toEqual([]);
    expect(getSettings().onboardingDone).toBe(false);
  });

  it('upgrades a database made before saved routes, keeping what was in it', () => {
    const old = newDatabase();
    MIGRATIONS.slice(0, 3).forEach((sql) => old.exec(sql));
    old.exec('PRAGMA user_version = 3');
    old.exec(
      `INSERT INTO events (id, source, title, startsAt, endsAt, timeZone, lat, lng, geocodeStatus,
        createdAt, updatedAt)
      VALUES ('abc', 'manual', 'Old dinner', 1000, 2000, 'UTC', 51.5, -0.12, 'located', 1, 1)`,
    );
    launchWith(old, (upgraded) => {
      expect(upgraded.listEvents()).toMatchObject([{ id: 'abc', lat: 51.5, geocodeStatus: 'located' }]);
      expect(old.prepare('PRAGMA user_version').get()).toEqual({ user_version: MIGRATIONS.length });
      expect(upgraded.findRoute({ lat: 51.5, lng: -0.12 }, { lat: 51.5, lng: -0.12 })).toBeNull();
    });
  });

  it('upgrades a database made before photos, keeping what was in it', () => {
    const old = newDatabase();
    old.exec(MIGRATIONS[0]);
    old.exec('PRAGMA user_version = 1');
    old.exec(
      `INSERT INTO events (id, source, title, startsAt, endsAt, timeZone, notes, createdAt, updatedAt)
      VALUES ('abc', 'manual', 'Old dinner', 1000, 2000, 'UTC', 'Bring wine', 1, 1)`,
    );

    launchWith(old, (upgraded) => {
      expect(upgraded.listEvents()).toMatchObject([
        { id: 'abc', title: 'Old dinner', notes: 'Bring wine', photo: null },
      ]);
      expect(old.prepare('PRAGMA user_version').get()).toEqual({ user_version: MIGRATIONS.length });

      upgraded.saveEvent({ ...dinner, photo: 'new.jpg' }, 'abc');
      expect(upgraded.listEvents()[0].photo).toBe('new.jpg');
    });
  });

  it('upgrades a database made before imports, sample events and all', () => {
    const old = newDatabase();
    old.exec(MIGRATIONS[0]);
    old.exec(MIGRATIONS[1]);
    old.exec('PRAGMA user_version = 2');
    old.exec(
      `INSERT INTO events (id, source, sourceId, title, startsAt, endsAt, timeZone, notes, photo,
        createdAt, updatedAt)
      VALUES ('s1', 'manual', 'sample:1', 'Sample one', 1000, 2000, 'UTC', '', NULL, 1, 1),
        ('s2', 'manual', 'sample:2', 'Sample two', 1000, 2000, 'UTC', '', 'sample.jpg', 1, 1),
        ('abc', 'manual', NULL, 'Old dinner', 1000, 2000, 'UTC', 'Bring wine', 'kept.jpg', 1, 1),
        ('def', 'manual', NULL, 'Old lunch', 3000, 4000, 'UTC', '', NULL, 1, 1)`,
    );
    const before = old.prepare('SELECT * FROM events ORDER BY id').all();

    launchWith(old, (upgraded) => {
      // The first read is what opens the database, and so what upgrades it.
      expect(upgraded.listEvents()).toHaveLength(4);
      expect(old.prepare('PRAGMA user_version').get()).toEqual({ user_version: MIGRATIONS.length });
      // Every row is as it was, with nothing marked as deleted.
      expect(old.prepare('SELECT * FROM events ORDER BY id').all()).toEqual(
        before.map((row) => ({ ...(row as object), deletedAt: null })),
      );

      // What the upgrade is for works on the old data: imports, and one row per key.
      expect(upgraded.importEvents([invite], { source: 'ics' }).added).toBe(1);
      expect(() =>
        old.exec(
          `INSERT INTO events (id, source, sourceId, title, startsAt, endsAt, timeZone, createdAt, updatedAt)
          VALUES ('s3', 'manual', 'sample:1', 'Sample again', 1000, 2000, 'UTC', 1, 1)`,
        ),
      ).toThrow();
      upgraded.deleteSampleEvents();
      expect(upgraded.listEvents().map((event) => event.title).sort()).toEqual([
        'Dinner',
        'Old dinner',
        'Old lunch',
      ]);
    });
  });

  it('still upgrades when two old rows share a key, keeping the first', () => {
    const old = newDatabase();
    old.exec(MIGRATIONS[0]);
    old.exec(MIGRATIONS[1]);
    old.exec('PRAGMA user_version = 2');
    old.exec(
      `INSERT INTO events (id, source, sourceId, title, startsAt, endsAt, timeZone, createdAt, updatedAt)
      VALUES ('s1', 'manual', 'sample:1', 'Sample one', 1000, 2000, 'UTC', 1, 1),
        ('s2', 'manual', 'sample:1', 'Sample one again', 1000, 2000, 'UTC', 1, 1),
        ('abc', 'manual', NULL, 'Old dinner', 1000, 2000, 'UTC', 1, 1),
        ('def', 'manual', NULL, 'Old dinner', 1000, 2000, 'UTC', 1, 1)`,
    );

    launchWith(old, (upgraded) => {
      // Events with no key are never touched, however alike they are.
      expect(upgraded.listEvents().map((event) => event.id).sort()).toEqual(['abc', 'def', 's1']);
      expect(old.prepare('PRAGMA user_version').get()).toEqual({ user_version: MIGRATIONS.length });
    });
  });

  it('opens again without being rebuilt, with everything still in it', () => {
    saveEvent(dinner);
    updateSettings({ onboardingDone: true });

    // A fresh copy of the module is what the app gets on its next launch.
    let reopened!: typeof import('./db');
    jest.isolateModules(() => {
      reopened = jest.requireActual('./db');
    });
    expect(reopened.listEvents()).toHaveLength(1);
    expect(reopened.getSettings().onboardingDone).toBe(true);
  });
});
