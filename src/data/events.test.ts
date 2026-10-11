import type { EventFields, ImportedEvent } from '../types';
import {
  deleteAllData,
  getEvents,
  importEvents,
  insertSampleEvents,
  nextPendingAddress,
  removeEvent,
  removeSampleEvents,
  saveEvent,
  setGeocode,
} from './events';
import { dropAllPhotos, dropPhoto, keepPhoto } from './photos';

// The store on top of the real SQL, with the photo files replaced by a list in memory:
// what matters here is that a photo is copied in, and deleted, at the right moments.
jest.mock('expo-sqlite', () => jest.requireActual('./sqlite.testing'));
jest.mock('./photos', () => {
  let count = 0;
  const prefix = 'file:///app/photos/';
  return {
    keepPhoto: jest.fn(() => `kept-${++count}.jpg`),
    photoUri: (name: string) => prefix + name,
    photoName: (uri: string) => (uri.startsWith(prefix) ? uri.slice(prefix.length) : null),
    dropPhoto: jest.fn(),
    dropAllPhotos: jest.fn(),
  };
});

const HOUR = 3_600_000;
const evening = new Date(2026, 9, 17, 19).getTime();

const dinner: EventFields = {
  title: 'Dinner',
  startsAt: evening,
  endsAt: evening + 2 * HOUR,
  allDay: false,
  locationText: '',
  host: '',
  url: null,
  notes: '',
};

/** The same dinner as a calendar file would hand it over. */
const invite: ImportedEvent = {
  sourceId: 'uid-1',
  title: 'Dinner',
  startsAt: evening,
  endsAt: evening + 2 * HOUR,
  allDay: false,
  locationText: '14 Alder Row',
  host: '',
  url: null,
  description: '',
};
const file = { source: 'ics' } as const;

const picked = 'file:///tmp/picked.jpg';
const only = () => getEvents()[0];

beforeEach(() => {
  deleteAllData();
  jest.clearAllMocks();
});

describe('an event photo', () => {
  it('is copied in when an event is saved with a picked photo', () => {
    saveEvent({ ...dinner, photo: picked });
    expect(keepPhoto).toHaveBeenCalledWith(picked);
    expect(only().photo).toMatch(/^file:\/\/\/app\/photos\/kept-\d+\.jpg$/);
    expect(dropPhoto).not.toHaveBeenCalled();
  });

  it('is left alone when the event is edited without touching it', () => {
    saveEvent({ ...dinner, photo: picked });
    const { id, photo } = only();
    jest.clearAllMocks();

    saveEvent({ ...dinner, title: 'Late dinner', photo }, id);

    expect(only()).toMatchObject({ title: 'Late dinner', photo });
    expect(keepPhoto).not.toHaveBeenCalled();
    expect(dropPhoto).not.toHaveBeenCalled();
  });

  it('replaces the old file when another photo is picked', () => {
    saveEvent({ ...dinner, photo: picked });
    const { id, photo: first } = only();

    saveEvent({ ...dinner, photo: 'file:///tmp/another.png' }, id);

    expect(only().photo).not.toBe(first);
    expect(dropPhoto).toHaveBeenCalledTimes(1);
    expect(dropPhoto).toHaveBeenCalledWith(first!.split('/').pop());
  });

  it('is deleted when it is removed from the event', () => {
    saveEvent({ ...dinner, photo: picked });
    const { id, photo } = only();

    saveEvent({ ...dinner, photo: null }, id);

    expect(only().photo).toBeNull();
    expect(dropPhoto).toHaveBeenCalledWith(photo!.split('/').pop());
  });

  it('is deleted with its event, and only then', () => {
    saveEvent({ ...dinner, photo: picked });
    saveEvent({ ...dinner, title: 'Lunch' });
    const [withPhoto] = getEvents().filter((event) => event.photo);
    const [without] = getEvents().filter((event) => !event.photo);

    removeEvent(without.id);
    expect(dropPhoto).not.toHaveBeenCalled();
    removeEvent(withPhoto.id);
    expect(dropPhoto).toHaveBeenCalledWith(withPhoto.photo!.split('/').pop());
    expect(getEvents()).toEqual([]);
  });

  it('is deleted with an imported event, which then stays away', () => {
    importEvents([invite], file);
    saveEvent({ ...only(), photo: picked }, only().id);
    const { id, photo } = only();
    jest.clearAllMocks();

    removeEvent(id);

    expect(dropPhoto).toHaveBeenCalledWith(photo!.split('/').pop());
    expect(getEvents()).toEqual([]);
    expect(importEvents([invite], file)).toEqual({ added: 0, updated: 0, unchanged: 0, skipped: 1 });
    expect(getEvents()).toEqual([]);
  });

  it('is left alone by an import that changes its event', () => {
    importEvents([invite], file);
    saveEvent({ ...only(), photo: picked }, only().id);
    const { photo } = only();
    jest.clearAllMocks();

    importEvents([{ ...invite, title: 'Late dinner' }], file);

    expect(only()).toMatchObject({ title: 'Late dinner', photo });
    expect(dropPhoto).not.toHaveBeenCalled();
  });

  it('goes when a sample event that was given one is replaced or removed', () => {
    insertSampleEvents();
    const sample = getEvents().find((event) => event.isSample)!;
    saveEvent({ ...sample, photo: picked }, sample.id);
    const kept = getEvents().find((event) => event.id === sample.id)!.photo!;
    jest.clearAllMocks();

    removeSampleEvents();

    expect(dropPhoto).toHaveBeenCalledTimes(1);
    expect(dropPhoto).toHaveBeenCalledWith(kept.split('/').pop());
  });

  it('all go with Delete all data', () => {
    saveEvent({ ...dinner, photo: picked });
    deleteAllData();
    expect(dropAllPhotos).toHaveBeenCalled();
    expect(getEvents()).toEqual([]);
  });
});

describe('events from the store', () => {
  it('come back soonest first, with the fields worked out on loading', () => {
    saveEvent({ ...dinner, title: 'Later', startsAt: evening + 24 * HOUR, endsAt: evening + 26 * HOUR });
    saveEvent(dinner);
    saveEvent({ ...dinner, title: 'Clash', startsAt: evening + HOUR, endsAt: evening + 3 * HOUR });

    expect(getEvents().map((event) => event.title)).toEqual(['Dinner', 'Clash', 'Later']);
    expect(getEvents().map((event) => event.hasConflict)).toEqual([true, true, false]);
    expect(getEvents().every((event) => !event.isSample && event.cover.length === 2)).toBe(true);
  });

  it('show an import at once, and never as a sample', () => {
    const result = importEvents([{ ...invite, sourceId: 'sample:1' }], file);
    expect(result).toEqual({ added: 1, updated: 0, unchanged: 0, skipped: 0 });
    expect(only()).toMatchObject({ title: 'Dinner', source: 'ics', isSample: false });

    removeSampleEvents();
    expect(getEvents()).toHaveLength(1);
  });

  it('show where an address is as soon as it is known', () => {
    saveEvent({ ...dinner, locationText: '14 Alder Row' });
    expect(only()).toMatchObject({ lat: null, lng: null, geocodeStatus: 'pending' });
    // Nothing was written, so nothing is read again.
    const before = getEvents();
    expect(nextPendingAddress()).toBe('14 Alder Row');
    expect(getEvents()).toBe(before);

    setGeocode('14 Alder Row', { lat: 51.5, lng: -0.12 });
    expect(only()).toMatchObject({ lat: 51.5, lng: -0.12, geocodeStatus: 'located' });

    // A second event at that address is filled in without the address being offered again.
    saveEvent({ ...dinner, title: 'Drinks', startsAt: evening + HOUR, locationText: '14 Alder Row' });
    expect(getEvents().map((event) => event.geocodeStatus)).toEqual(['located', 'pending']);
    expect(nextPendingAddress()).toBeNull();
    expect(getEvents().map((event) => event.geocodeStatus)).toEqual(['located', 'located']);
  });
});
