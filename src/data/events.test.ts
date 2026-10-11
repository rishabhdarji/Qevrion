import type { EventFields } from '../types';
import {
  deleteAllData,
  getEvents,
  insertSampleEvents,
  removeEvent,
  removeSampleEvents,
  saveEvent,
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
});
