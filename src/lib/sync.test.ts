import * as Calendar from 'expo-calendar/legacy';

import { getSettings } from '../data/db';
import { importEvents } from '../data/events';
import type { Settings } from '../types';
import { locateVenues } from './geocode';
import { importFile, syncCalendars } from './sync';

// The sync with the calendar, the store, the file and the map queue replaced. Each
// test starts two minutes after the last, so the one-a-minute rule only applies where
// a test asks for it.
jest.mock('expo-calendar/legacy', () => ({
  EntityTypes: { EVENT: 'event' },
  getCalendarPermissionsAsync: jest.fn(),
  requestCalendarPermissionsAsync: jest.fn(),
  getCalendarsAsync: jest.fn(),
  getEventsAsync: jest.fn(),
}));
jest.mock('../data/db', () => ({ getSettings: jest.fn() }));
jest.mock('../data/events', () => ({ importEvents: jest.fn() }));
jest.mock('./geocode', () => ({ locateVenues: jest.fn() }));

const files: Record<string, { size: number; text: string | Error }> = {};
/** The picked files whose cached copy was deleted. */
const deleted: string[] = [];
jest.mock('expo-file-system', () => ({
  File: class {
    size: number;
    text: () => Promise<string>;
    delete: () => void;
    constructor(uri: string) {
      const { size, text } = files[uri];
      this.size = size;
      this.text = jest.fn(async () => {
        if (text instanceof Error) throw text;
        return text;
      });
      this.delete = () => {
        deleted.push(uri);
        // A copy that cannot be deleted must not turn a good import into a failure.
        if (uri.includes('stuck')) throw new Error('EPERM');
      };
    }
  },
}));

const access = jest.mocked(Calendar.getCalendarPermissionsAsync);
const calendars = jest.mocked(Calendar.getCalendarsAsync);
const read = jest.mocked(Calendar.getEventsAsync);
const store = jest.mocked(importEvents);

const counts = { added: 2, updated: 1, unchanged: 3, skipped: 0 };
const event = (id: string, notes = '') =>
  ({
    id,
    calendarId: 'home',
    title: `Event ${id}`,
    notes,
    startDate: new Date(2026, 9, 17, 19).toISOString(),
    endDate: new Date(2026, 9, 17, 21).toISOString(),
    allDay: false,
  }) as Calendar.Event;

function chosen(importCalendarIds: string[], onlyPartifulLinks = false) {
  jest.mocked(getSettings).mockReturnValue({ importCalendarIds, onlyPartifulLinks } as Settings);
}

let clock = new Date(2026, 9, 17, 12).getTime();

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime((clock += 120_000));
  access.mockResolvedValue({ granted: true } as Calendar.PermissionResponse);
  calendars.mockResolvedValue([{ id: 'home' }, { id: 'work' }] as Calendar.Calendar[]);
  read.mockResolvedValue([event('a'), event('b', 'https://partiful.com/e/EXAMPLE123')]);
  store.mockReturnValue(counts);
  chosen(['home']);
});

afterEach(() => jest.useRealTimers());

describe('syncCalendars', () => {
  it('reads the chosen calendars that still exist, once, and imports what they hold', async () => {
    chosen(['home', 'deleted-on-the-phone']);
    expect(await syncCalendars()).toEqual(counts);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][0]).toEqual(['home']);
    const [incoming, scope] = store.mock.calls[0];
    expect(incoming.map((item) => item.sourceId)).toEqual(['home|a', 'home|b']);
    expect(scope).toMatchObject({ source: 'calendar', calendarIds: ['home'], present: ['home|a', 'home|b'] });
    expect(locateVenues).toHaveBeenCalled();
  });

  it('counts what the Partiful switch left out as skipped, but not as gone', async () => {
    chosen(['home'], true);
    expect(await syncCalendars()).toEqual({ ...counts, skipped: 1 });
    const [incoming, scope] = store.mock.calls[0];
    expect(incoming.map((item) => item.sourceId)).toEqual(['home|b']);
    expect(scope).toMatchObject({ present: ['home|a', 'home|b'] });
  });

  it('never asks for access, and does nothing without it', async () => {
    access.mockResolvedValue({ granted: false } as Calendar.PermissionResponse);
    expect(await syncCalendars()).toBeNull();
    expect(Calendar.requestCalendarPermissionsAsync).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('does nothing when no chosen calendar is left', async () => {
    chosen([]);
    expect(await syncCalendars({ force: true })).toBeNull();
    chosen(['deleted-on-the-phone']);
    expect(await syncCalendars({ force: true })).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('imports nothing when the calendars answer with no events at all', async () => {
    read.mockResolvedValue([]);
    expect(await syncCalendars()).toEqual({ added: 0, updated: 0, unchanged: 0, skipped: 0 });
    expect(store).not.toHaveBeenCalled();
  });

  it('counts a calendar that answers with no events as not read, so it marks nothing removed', async () => {
    chosen(['home', 'work']);
    await syncCalendars();
    expect(read.mock.calls[0][0]).toEqual(['home', 'work']);
    expect(store.mock.calls[0][1]).toMatchObject({ calendarIds: ['home'] });
  });

  it('runs one at a time, rests for a minute unless forced, and hands errors back', async () => {
    const first = syncCalendars();
    expect(syncCalendars()).toBe(first);
    await first;
    expect(read).toHaveBeenCalledTimes(1);

    jest.setSystemTime(clock + 30_000);
    expect(await syncCalendars()).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);

    read.mockRejectedValue(new Error('The calendar could not be read.'));
    await expect(syncCalendars({ force: true })).rejects.toThrow('The calendar could not be read.');
  });

  it('gives every forced sync that arrives during one the same single fresh read', async () => {
    const background = syncCalendars();
    const first = syncCalendars({ force: true });
    const second = syncCalendars({ force: true });
    expect(second).toBe(first);
    await Promise.all([background, first, second]);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('reads again after the sync under way when forced, to pick up new choices', async () => {
    // The sync under way read the old choice; the import screen has just saved a new one.
    jest
      .mocked(getSettings)
      .mockReturnValueOnce({ importCalendarIds: ['home'] } as Settings)
      .mockReturnValue({ importCalendarIds: ['work'] } as Settings);
    const background = syncCalendars();
    const forced = syncCalendars({ force: true });
    expect(forced).not.toBe(background);
    await Promise.all([background, forced]);
    expect(read.mock.calls.map(([ids]) => ids)).toEqual([['home'], ['work']]);
  });
});

describe('importFile', () => {
  const calendar = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:dinner@example.com',
    'DTSTART:20261017T170000Z',
    'SUMMARY:Dinner',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:weekly@example.com',
    'DTSTART:20261017T170000Z',
    'RRULE:FREQ=WEEKLY',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  it('imports the events of a file and says how many repeating ones were left out', async () => {
    files['file:///cache/party.ics'] = { size: calendar.length, text: calendar };
    expect(await importFile('file:///cache/party.ics')).toEqual({ ...counts, repeating: 1 });
    expect(store.mock.calls[0][0].map((item) => item.sourceId)).toEqual(['dinner@example.com']);
    expect(store.mock.calls[0][1]).toEqual({ source: 'ics' });
    expect(locateVenues).toHaveBeenCalled();
    expect(deleted).toContain('file:///cache/party.ics');
  });

  it('deletes the cached copy whatever happens, and ignores a copy it cannot delete', async () => {
    files['file:///cache/stuck.ics'] = { size: calendar.length, text: calendar };
    expect(await importFile('file:///cache/stuck.ics')).toEqual({ ...counts, repeating: 1 });
    files['file:///cache/broken.ics'] = { size: 10, text: 'not a calendar' };
    await expect(importFile('file:///cache/broken.ics')).rejects.toThrow('This file is not a calendar.');
    expect(deleted).toEqual(expect.arrayContaining(['file:///cache/stuck.ics', 'file:///cache/broken.ics']));
  });

  it('refuses a file over 2 MB before reading it', async () => {
    files['file:///cache/huge.ics'] = { size: 2 * 1024 * 1024 + 1, text: new Error('read') };
    await expect(importFile('file:///cache/huge.ics')).rejects.toThrow('This file is too big to import.');
    expect(store).not.toHaveBeenCalled();
  });

  it('says plainly when a file cannot be read or is not a calendar', async () => {
    files['file:///cache/locked.ics'] = { size: 10, text: new Error('EACCES /private/var/...') };
    await expect(importFile('file:///cache/locked.ics')).rejects.toThrow('This file could not be read.');
    files['file:///cache/photo.ics'] = { size: 10, text: 'not a calendar' };
    await expect(importFile('file:///cache/photo.ics')).rejects.toThrow('This file is not a calendar.');
    expect(store).not.toHaveBeenCalled();
  });
});
