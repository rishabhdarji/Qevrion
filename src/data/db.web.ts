import type { Settings } from '../types';
import type * as Phone from './db';

// The desktop web preview's stand-in for db.ts; the iPhone never loads this file.
//
// Metro picks a `.web.ts` file over its plain twin when it bundles for a browser. Expo's
// SQLite cannot run this app there (STATUS.md, Known issues), so in the preview events
// and settings live in memory and are gone on reload. Nothing here is SQL: the real
// queries are tested in db.test.ts.
//
// Keep the exports in step with db.ts. One that is missing shows up as an error in the
// preview at once, and never on the phone.

export const SAMPLE_PREFIX: typeof Phone.SAMPLE_PREFIX = 'sample:';

const DEFAULTS: Settings = {
  defaultOffsets: [1440, 120, 30],
  digestEnabled: true,
  digestTime: 480,
  weeklyPreviewEnabled: true,
  importCalendarIds: [],
  onlyPartifulLinks: false,
  units: 'mi',
  onboardingDone: false,
};

// A drawn picture standing in for a photo, bright on purpose so the title's fade can be
// judged. The preview cannot work the browser's own file picker.
const PREVIEW_PHOTO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="none">' +
      '<rect width="400" height="300" fill="#F4D58D"/><circle cx="300" cy="80" r="60" fill="#FFF6D6"/>' +
      '<path d="M0 220 L120 120 L220 200 L300 150 L400 230 V300 H0Z" fill="#E07A5F"/></svg>',
  );

const HOUR = 3_600_000;

let nextId = 1;
let settings: Settings = { ...DEFAULTS };
let events: Phone.StoredEvent[] = [];

/** One event that already has a picture, so the photo screens can be looked at. */
function seed() {
  const startsAt = Date.now() + 26 * HOUR;
  saveEvent({
    sourceId: `${SAMPLE_PREFIX}preview`,
    title: 'Preview: an event with a photo',
    startsAt,
    endsAt: startsAt + 2 * HOUR,
    allDay: false,
    locationText: 'The Glasshouse, 14 Alder Row',
    host: 'Maya Okafor',
    url: null,
    notes: '',
    photo: PREVIEW_PHOTO,
  });
}

export const listEvents: typeof Phone.listEvents = () => events;

export const saveEvent: typeof Phone.saveEvent = (fields, id) => {
  const old = events.find((event) => event.id === id);
  const description = old?.description ?? fields.description ?? '';
  const saved: Phone.StoredEvent = {
    id: id ?? `preview-${nextId++}`,
    source: 'manual',
    sourceId: old?.sourceId ?? fields.sourceId ?? null,
    title: fields.title,
    startsAt: fields.startsAt,
    endsAt: fields.endsAt,
    allDay: fields.allDay,
    locationText: fields.locationText,
    host: fields.host,
    url: fields.url,
    notes: fields.notes,
    photo: fields.photo ?? null,
    description,
    keyDetails: old?.keyDetails ?? fields.keyDetails ?? [],
    isPartiful: /partiful\.com/i.test(`${fields.url} ${description}`),
  };
  events = [...events.filter((event) => event.id !== saved.id), saved];
};

export const deleteEvent: typeof Phone.deleteEvent = (id) => {
  events = events.filter((event) => event.id !== id);
};

export const deleteSampleEvents: typeof Phone.deleteSampleEvents = () => {
  events = events.filter((event) => !event.sourceId?.startsWith(SAMPLE_PREFIX));
};

export const replaceSampleEvents: typeof Phone.replaceSampleEvents = (samples) => {
  deleteSampleEvents();
  samples.forEach((sample) => saveEvent(sample));
};

export const deleteAllData: typeof Phone.deleteAllData = () => {
  events = [];
  settings = { ...DEFAULTS };
};

export const getSettings: typeof Phone.getSettings = () => settings;

export const updateSettings: typeof Phone.updateSettings = (patch) => {
  settings = { ...settings, ...patch };
};

seed();
