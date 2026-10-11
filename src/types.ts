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
  host: string;
  description: string;
  url: string | null;
  isPartiful: boolean;
  notes: string;
  keyDetails: string[];
  /** Where the event's own photo is, ready to show. Null when it has none. */
  photo: string | null;

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
