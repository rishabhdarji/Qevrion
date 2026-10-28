import { isPlace, type LatLng } from './geo';

// Address suggestions while typing "Where" on the add/edit form. Two free services
// are behind the same shape, and both use OpenStreetMap data:
//   Photon, run by komoot, which needs no key;
//   openrouteservice's autocomplete (Pelias), with the same free key as the routes.
// Google's suggestions need a billing account with a credit card, so they are out.
// What is sent: the letters typed, and roughly where the owner is if they have
// already allowed location. Nothing else about the event.

export type SuggestSource = 'photon' | 'openrouteservice';

export type Suggestion = {
  /** The first line: a place's name, or the house number and street. */
  title: string;
  /** The rest: town, region, postcode. */
  detail: string;
  /** What goes into the field when it is tapped. */
  full: string;
  lat: number;
  lng: number;
};

/** Credit each service asks for, and where the suggestions come from, for the screen. */
export const SOURCE_NAME: Record<SuggestSource, string> = {
  photon: 'Photon by komoot, OpenStreetMap data',
  openrouteservice: 'openrouteservice, OpenStreetMap data',
};

/** Fewer letters than this find nothing worth showing. */
export const MIN_LETTERS = 3;
const MAX_LETTERS = 200;
const SHOWN = 5;
const TIMEOUT_MS = 8000;
/** A link is nobody's address, and is never sent (as for the geocoder). */
const LINK = /[a-z][a-z0-9+.-]*:\/\//i;

/** What would be sent for this text, or null if it should not be sent at all. */
export function queryFor(text: string): string | null {
  const query = text.replace(/\s+/g, ' ').trim();
  if (query.length < MIN_LETTERS || query.length > MAX_LETTERS || LINK.test(query)) return null;
  return query;
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const join = (parts: string[], mark = ', ') => parts.filter(Boolean).join(mark);

/**
 * Countries where the house number follows the street ("Hauptstraße 5"). Elsewhere it
 * comes first ("5 Main Street"), as in the US, UK, Canada and Australia.
 */
const NUMBER_AFTER = new Set(
  'AT BA BE BG BR CH CL CZ DE DK EE ES FI GR HR HU IS IT LT LU LV MX NL NO PL PT RO RS SE SI SK TR UA AR'.split(' '),
);

/** Drops repeats, which both services give for a building with several entrances. */
function distinct(list: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  return list.filter((s) => !seen.has(s.full.toLowerCase()) && !!seen.add(s.full.toLowerCase()));
}

type Feature = { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };

function point(feature: Feature): LatLng | null {
  const c = feature.geometry?.coordinates;
  const p = Array.isArray(c) ? { lat: c[1], lng: c[0] } : null;
  return isPlace(p) ? p : null;
}

const features = (body: unknown): Feature[] => {
  const list = (body as { features?: unknown } | null)?.features;
  return Array.isArray(list) ? list.filter((f): f is Feature => !!f && typeof f === 'object') : [];
};

/** Reads Photon's answer, which gives the parts of an address but not a written-out line. */
export function parsePhoton(body: unknown, homeCountry = ''): Suggestion[] {
  const out: Suggestion[] = [];
  for (const feature of features(body)) {
    const at = point(feature);
    const p = feature.properties ?? {};
    if (!at) continue;
    const country = str(p.countrycode).toUpperCase();
    const number = str(p.housenumber);
    const street = str(p.street);
    const name = str(p.name);
    const road = NUMBER_AFTER.has(country) ? join([street, number], ' ') : join([number, street], ' ');
    const town = str(p.city) || str(p.town) || str(p.village) || str(p.locality) || str(p.district);
    const region = join([str(p.state), str(p.postcode)], ' ');
    // The country only when it is not the phone's own, to keep the line short.
    const where = join([town, region, country && country !== homeCountry ? str(p.country) : '']);
    // A shop or a venue has a name and an address; a house has only the address. A
    // street on its own comes back with its name as the name.
    const title = name && name !== street ? name : road || name;
    if (!title) continue;
    const detail = join([title === road ? '' : road, where]);
    out.push({ title, detail, full: join([title, detail]), ...at });
  }
  return distinct(out).slice(0, SHOWN);
}

/** Reads openrouteservice's answer, which writes the full line out itself. */
export function parseOrs(body: unknown): Suggestion[] {
  const out: Suggestion[] = [];
  for (const feature of features(body)) {
    const at = point(feature);
    const p = feature.properties ?? {};
    const label = str(p.label);
    if (!at || !label) continue;
    const name = str(p.name);
    const title = name && label.startsWith(name) ? name : label.split(',')[0].trim();
    const detail = label.slice(title.length).replace(/^[\s,]+/, '');
    out.push({ title, detail, full: label, ...at });
  }
  return distinct(out).slice(0, SHOWN);
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type SuggestOptions = {
  /** Roughly where the owner is, to put nearby places first. */
  near?: LatLng | null;
  /** The openrouteservice key, needed for that source. */
  key?: string | null;
  /** The phone's country as two letters, to leave it off each line. */
  homeCountry?: string;
  signal?: AbortSignal;
  fetcher?: Fetch;
};

/** The address of the question, for each source. */
export function suggestUrl(source: SuggestSource, query: string, near?: LatLng | null): string {
  const params = new URLSearchParams();
  if (source === 'photon') {
    params.set('q', query);
    params.set('limit', String(SHOWN + 3));
    params.set('lang', 'en');
    if (near) {
      // A little rounding: nearby is the point, not the exact spot.
      params.set('lat', near.lat.toFixed(3));
      params.set('lon', near.lng.toFixed(3));
    }
    return `https://photon.komoot.io/api/?${params}`;
  }
  params.set('text', query);
  params.set('size', String(SHOWN + 3));
  if (near) {
    params.set('focus.point.lat', near.lat.toFixed(3));
    params.set('focus.point.lon', near.lng.toFixed(3));
  }
  return `https://api.openrouteservice.org/geocode/autocomplete?${params}`;
}

export class SuggestError extends Error {
  constructor(readonly problem: 'offline' | 'noKey' | 'badKey' | 'quota' | 'failed') {
    super(problem);
  }
}

/** Asks one source for addresses matching what has been typed. */
export async function fetchSuggestions(
  source: SuggestSource,
  text: string,
  { near, key, homeCountry = '', signal, fetcher = fetch as Fetch }: SuggestOptions = {},
): Promise<Suggestion[]> {
  const query = queryFor(text);
  if (!query) return [];
  if (source === 'openrouteservice' && !key) throw new SuggestError('noKey');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => abort.abort());
  let response: Response;
  let body: unknown;
  try {
    response = await fetcher(suggestUrl(source, query, near), {
      // openrouteservice takes the key in this header for every service (its own
      // Python client sends it this way), so it is never part of an address.
      headers: { Accept: 'application/json', ...(key && source === 'openrouteservice' ? { Authorization: key } : {}) },
      signal: abort.signal,
    });
    body = await response.json().catch(() => null);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new SuggestError('offline');
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 401 || response.status === 403) throw new SuggestError('badKey');
  if (response.status === 429) throw new SuggestError('quota');
  if (!response.ok) throw new SuggestError('failed');
  return source === 'photon' ? parsePhoton(body, homeCountry) : parseOrs(body);
}

/**
 * Which source the form uses: openrouteservice, which the owner found best on real,
 * partly typed addresses on the iPhone (27 Oct 2026), whenever a key is set; Photon,
 * which needs no key, when it is not.
 */
export const suggestSource = (key: string | null): SuggestSource => (key ? 'openrouteservice' : 'photon');

/** The phone's country as two letters, from its language setting ("en-US" gives "US"). */
export function phoneCountry(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return /-([A-Z]{2})\b/.exec(locale)?.[1] ?? '';
}
