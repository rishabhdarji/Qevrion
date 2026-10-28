import { distance } from '../lib/geo';
import { planImport } from '../lib/importPlan';
import type { WalkingRoute } from '../lib/route';
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
  walkSafetySeen: false,
  simulateWalk: false,
  recordWalks: false,
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

const partiful = (...texts: (string | null)[]) => /partiful\.com/i.test(texts.join(' '));

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
    // An invented place, so Navigate has somewhere to point in the preview.
    place: { lat: 40.7536, lng: -73.9832 },
  });
}

export const listEvents: typeof Phone.listEvents = () => events;

export const saveEvent: typeof Phone.saveEvent = (fields, id) => {
  const old = events.find((event) => event.id === id);
  const description = old?.description ?? fields.description ?? '';
  const saved: Phone.StoredEvent = {
    id: id ?? `preview-${nextId++}`,
    source: old?.source ?? 'manual',
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
    isPartiful: partiful(fields.url, description, fields.locationText),
    // Nothing is looked up on a map in the preview: a place is only known when it was
    // picked from the suggestions, or kept from before when the address is the same.
    ...(fields.place
      ? { ...fields.place, geocodeStatus: 'located' as const }
      : old && old.locationText === fields.locationText
        ? { lat: old.lat, lng: old.lng, geocodeStatus: old.geocodeStatus }
        : { lat: null, lng: null, geocodeStatus: 'pending' as const }),
    removedFromSource: old?.removedFromSource ?? false,
  };
  events = [...events.filter((event) => event.id !== saved.id), saved];
};

// Really deletes, whatever the event came from. On the phone a deleted import is kept
// out of sight so that the next import does not bring it back; here it would come back.
export const deleteEvent: typeof Phone.deleteEvent = (id) => {
  events = events.filter((event) => event.id !== id);
};

export const deleteSampleEvents: typeof Phone.deleteSampleEvents = () => {
  events = events.filter(
    (event) => !(event.source === 'manual' && event.sourceId?.startsWith(SAMPLE_PREFIX)),
  );
};

export const replaceSampleEvents: typeof Phone.replaceSampleEvents = (samples) => {
  deleteSampleEvents();
  samples.forEach((sample) => saveEvent(sample));
};

/** The phone's rules (src/lib/importPlan.ts), applied to the list in memory. */
export const importEvents: typeof Phone.importEvents = (incoming, scope) => {
  const plan = planImport(
    events.flatMap((event) =>
      event.source === scope.source && event.sourceId !== null
        ? [{ ...event, sourceId: event.sourceId, deleted: false }]
        : [],
    ),
    incoming,
    scope,
  );
  const row = (id: string) => events.find((event) => event.id === id)!;
  plan.updates.forEach(({ id, event }) =>
    Object.assign(row(id), event, {
      isPartiful: partiful(event.url, event.description, event.locationText),
      removedFromSource: false,
    }),
  );
  plan.rekeys.forEach(({ id, sourceId }) => Object.assign(row(id), { sourceId }));
  plan.removed.forEach((id) => Object.assign(row(id), { removedFromSource: true }));
  events = [
    ...events,
    ...plan.inserts.map(
      (event): Phone.StoredEvent => ({
        ...event,
        id: `preview-${nextId++}`,
        source: scope.source,
        isPartiful: partiful(event.url, event.description, event.locationText),
        notes: '',
        keyDetails: [],
        photo: null,
        lat: null,
        lng: null,
        geocodeStatus: 'pending',
        removedFromSource: false,
      }),
    ),
  ];
  const { inserts, updates, rekeys, removed } = plan;
  return { ...plan.result, wrote: inserts.length + updates.length + rekeys.length + removed.length > 0 };
};

// Nothing is looked up on a map in the preview, so there is never an address waiting.
export const nextPendingAddress: typeof Phone.nextPendingAddress = () => ({ address: null, reused: 0 });
export const setGeocode: typeof Phone.setGeocode = () => {};

let routes: WalkingRoute[] = [];

export const ROUTE_FROM_M: typeof Phone.ROUTE_FROM_M = 75;
export const ROUTE_KEEP_MS: typeof Phone.ROUTE_KEEP_MS = 14 * 24 * 3_600_000;

export const findRoute: typeof Phone.findRoute = (from, to, now = Date.now()) =>
  routes.find(
    (route) =>
      route.fetchedAt > now - ROUTE_KEEP_MS &&
      distance(route.to, to) <= 25 &&
      distance(route.from, from) <= ROUTE_FROM_M,
  ) ?? null;

export const keepRoute: typeof Phone.keepRoute = (route) => {
  routes = [route, ...routes].slice(0, 40);
};

export const deleteAllData: typeof Phone.deleteAllData = () => {
  events = [];
  routes = [];
  settings = { ...DEFAULTS };
};

export const getSettings: typeof Phone.getSettings = () => settings;

export const updateSettings: typeof Phone.updateSettings = (patch) => {
  settings = { ...settings, ...patch };
};

seed();
