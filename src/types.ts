/** Whether the address has been looked up yet, and whether a place was found for it. */
export type GeocodeStatus = 'pending' | 'located' | 'notFound';

// Field names follow SPEC section 7. The database (src/data/db.ts) stores every field
// in the spec; this is the part of an event the screens read.
export type QevrionEvent = {
  id: string;
  source: 'calendar' | 'ics' | 'manual';
  title: string;
  /**
   * Milliseconds since the epoch (UTC). Shown in the device time zone. For an all-day
   * event this is the first moment of its first day on this phone.
   */
  startsAt: number;
  /** For an all-day event, the first moment of the day after its last day. */
  endsAt: number;
  allDay: boolean;
  locationText: string;
  /** Where `locationText` is on the map. Null until it has been found. */
  lat: number | null;
  lng: number | null;
  geocodeStatus: GeocodeStatus;
  host: string;
  description: string;
  url: string | null;
  isPartiful: boolean;
  notes: string;
  keyDetails: string[];
  /** Where the event's own photo is, ready to show. Null when it has none. */
  photo: string | null;
  /** An imported event that its calendar no longer has. Kept, and shown as removed. */
  removedFromSource: boolean;

  // Worked out when events are loaded (src/data/events.ts), not stored.
  isSample: boolean;
  cover: readonly [string, string];
  hasConflict: boolean;
};

/** What a person or an importer supplies. Everything else is worked out on saving. */
export type EventFields = Pick<
  QevrionEvent,
  'title' | 'startsAt' | 'endsAt' | 'allDay' | 'locationText' | 'host' | 'url' | 'notes'
> & {
  /** A photo to show: the one the event already has, or one just picked. */
  photo?: string | null;
  // Written when the event is created and left alone by later edits.
  sourceId?: string;
  description?: string;
  keyDetails?: string[];
};

/** An event as a calendar or an .ics file gives it. Times follow QevrionEvent's rules. */
export type ImportedEvent = { sourceId: string } & Pick<
  QevrionEvent,
  'title' | 'startsAt' | 'endsAt' | 'allDay' | 'locationText' | 'host' | 'url' | 'description'
>;

/**
 * What an import covered, which decides what may be called gone from the calendar.
 * `present` is every `sourceId` the calendars returned between `from` and `to`, before
 * any filtering, so an event that was only filtered out is never marked as removed.
 */
export type ImportScope =
  | { source: 'ics' }
  | { source: 'calendar'; calendarIds: string[]; from: number; to: number; present: string[] };

export type ImportResult = { added: number; updated: number; unchanged: number; skipped: number };

/** SPEC section 7, Settings. The route key is in secure storage, not here. */
export type Settings = {
  /** Minutes before an event. */
  defaultOffsets: number[];
  digestEnabled: boolean;
  /** Minutes after midnight. */
  digestTime: number;
  weeklyPreviewEnabled: boolean;
  importCalendarIds: string[];
  onlyPartifulLinks: boolean;
  units: 'mi' | 'km';
  onboardingDone: boolean;
};
