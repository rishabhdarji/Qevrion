// Field names follow SPEC section 7 so Round 2 can extend this into the stored model.
export type QevrionEvent = {
  id: string;
  source: 'calendar' | 'ics' | 'manual';
  title: string;
  /** Milliseconds since the epoch (UTC). Shown in the device time zone. */
  startsAt: number;
  endsAt: number;
  locationText: string;
  host: string;
  description: string;
  url: string | null;
  isPartiful: boolean;
  keyDetails: string[];

  // Round 1 only: sample data has no stored cover image or conflict detection yet.
  isSample: boolean;
  cover: readonly [string, string];
  hasConflict: boolean;
};
