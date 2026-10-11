import { findConflicts } from '../lib/conflicts';
import { startOfDay } from '../lib/dates';
import type { EventFields } from '../types';
import {
  deleteAllData,
  deleteEvent,
  deleteSampleEvents,
  getSettings,
  listEvents,
  replaceSampleEvents,
  saveEvent,
  updateSettings,
} from './db';
import { makeSampleEvents, SAMPLE_COUNT } from './sampleEvents';

// The real SQL runs here, against the SQLite built into Node standing in for the
// phone's. A mistake in the schema or a query fails this file instead of the app.
jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = jest.requireActual('node:sqlite');
  // One database for the whole file, as one file on the phone would be, so opening
  // it a second time finds what was saved.
  const shared = globalThis as { testDatabase?: any };
  // The phone ignores a parameter name it does not know and binds nothing; be as strict.
  const db = (shared.testDatabase ??= new DatabaseSync(':memory:', {
    allowBareNamedParameters: false,
  }));
  const args = (params?: unknown) => (params == null ? [] : Array.isArray(params) ? params : [params]);
  return {
    openDatabaseSync: () => ({
      execSync: (sql: string) => db.exec(sql),
      runSync: (sql: string, params?: unknown) => db.prepare(sql).run(...args(params)),
      getAllSync: (sql: string, params?: unknown) => db.prepare(sql).all(...args(params)),
      getFirstSync: (sql: string, params?: unknown) => db.prepare(sql).get(...args(params)) ?? null,
      withTransactionSync: (task: () => void) => {
        db.exec('BEGIN');
        try {
          task();
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
    }),
  };
});

const HOUR = 3_600_000;
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

describe('the database file', () => {
  it('is wiped by Delete all data, settings included', () => {
    saveEvent(dinner);
    updateSettings({ onboardingDone: true });
    deleteAllData();
    expect(listEvents()).toEqual([]);
    expect(getSettings().onboardingDone).toBe(false);
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
