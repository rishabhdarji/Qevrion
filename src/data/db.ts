import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { allDayToLocal, allDayToUtc } from '../lib/dates';
import { distance, isPlace, type LatLng } from '../lib/geo';
import { planImport, type ExistingEvent } from '../lib/importPlan';
import type { WalkingRoute } from '../lib/route';
import type {
  EventFields,
  ImportedEvent,
  ImportResult,
  ImportScope,
  QevrionEvent,
  Settings,
} from '../types';

// The only file that talks to SQLite. Screens never import this for events; they go
// through src/data/events.ts, which keeps what is read here in memory.
//
// Calls are synchronous on purpose: a few hundred small rows take a few milliseconds,
// and nothing above this file has to deal with a loading state.

// One entry per schema version, run in order. Never edit an entry that has shipped:
// to change the schema, add a new one. Version 1 is SPEC section 7 (Event, Settings).
// Lists are JSON text and yes/no values are 0 or 1. Version 2 adds the event's photo,
// stored as a file name (src/data/photos.ts). Version 3 is for imports: `deletedAt`
// marks an imported event the owner deleted, kept so that the next sync does not bring
// it back, and an event's key becomes unique within the calendar or file it came from.
// A row that shares its key with an earlier one is dropped first: the index could not
// be built over it, and a database that cannot be upgraded cannot be opened. Version 4
// keeps walking routes, so the same walk does not use up the route key's daily limit.
// Version 5 is for AR Walk: whether its safety note has been seen, and the two
// Developer switches that simulate and record walks.
export const MIGRATIONS = [
  `CREATE TABLE events (
    id TEXT PRIMARY KEY NOT NULL,
    source TEXT NOT NULL,
    sourceId TEXT,
    title TEXT NOT NULL,
    startsAt INTEGER NOT NULL,
    endsAt INTEGER NOT NULL CHECK (endsAt >= startsAt),
    allDay INTEGER NOT NULL DEFAULT 0,
    timeZone TEXT NOT NULL,
    locationText TEXT NOT NULL DEFAULT '',
    lat REAL,
    lng REAL,
    geocodeStatus TEXT NOT NULL DEFAULT 'pending',
    url TEXT,
    host TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    isPartiful INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    checklist TEXT NOT NULL DEFAULT '[]',
    keyDetails TEXT NOT NULL DEFAULT '[]',
    reminderOffsets TEXT,
    removedFromSource INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    lastSyncedAt INTEGER
  ) STRICT;
  CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    defaultOffsets TEXT NOT NULL DEFAULT '[1440,120,30]',
    digestEnabled INTEGER NOT NULL DEFAULT 1,
    digestTime INTEGER NOT NULL DEFAULT 480,
    weeklyPreviewEnabled INTEGER NOT NULL DEFAULT 1,
    importCalendarIds TEXT NOT NULL DEFAULT '[]',
    onlyPartifulLinks INTEGER NOT NULL DEFAULT 0,
    units TEXT NOT NULL DEFAULT 'mi',
    onboardingDone INTEGER NOT NULL DEFAULT 0
  ) STRICT;
  INSERT INTO settings (id) VALUES (1);`,
  `ALTER TABLE events ADD COLUMN photo TEXT;`,
  `ALTER TABLE events ADD COLUMN deletedAt INTEGER;
  DELETE FROM events WHERE sourceId IS NOT NULL AND rowid NOT IN (
    SELECT min(rowid) FROM events WHERE sourceId IS NOT NULL GROUP BY source, sourceId);
  CREATE UNIQUE INDEX events_source ON events (source, sourceId) WHERE sourceId IS NOT NULL;`,
  `CREATE TABLE routes (
    id INTEGER PRIMARY KEY,
    fromLat REAL NOT NULL,
    fromLng REAL NOT NULL,
    toLat REAL NOT NULL,
    toLng REAL NOT NULL,
    distance REAL NOT NULL,
    duration REAL NOT NULL,
    line TEXT NOT NULL,
    steps TEXT NOT NULL,
    fetchedAt INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX routes_to ON routes (toLat);`,
  `ALTER TABLE settings ADD COLUMN walkSafetySeen INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE settings ADD COLUMN simulateWalk INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE settings ADD COLUMN recordWalks INTEGER NOT NULL DEFAULT 0;`,
];

let opened: SQLiteDatabase | undefined;

function db(): SQLiteDatabase {
  if (!opened) {
    const database = openDatabaseSync('qevrion.db');
    database.execSync('PRAGMA journal_mode = WAL');
    const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
    const version = row?.user_version ?? 0;
    MIGRATIONS.slice(version).forEach((sql, index) => {
      // Together, so a migration that fails half-way leaves the old version intact.
      database.withTransactionSync(() => {
        database.execSync(sql);
        database.execSync(`PRAGMA user_version = ${version + index + 1}`);
      });
    });
    opened = database;
  }
  return opened;
}

// Events

/** Sample events carry this at the start of `sourceId`, which is how they are found again. */
export const SAMPLE_PREFIX = 'sample:';

/** An event as the database holds it. Here `photo` is the photo's file name, not its address. */
export type StoredEvent = Omit<QevrionEvent, 'isSample' | 'cover' | 'hasConflict'> & {
  sourceId: string | null;
};

type EventRow = Omit<StoredEvent, 'allDay' | 'isPartiful' | 'keyDetails' | 'removedFromSource'> & {
  allDay: number;
  isPartiful: number;
  keyDetails: string;
  removedFromSource: number;
};

/** A row's times as the app holds them: all-day dates become this phone's days. */
function localTimes(row: { allDay: number; startsAt: number; endsAt: number }) {
  const allDay = row.allDay === 1;
  return {
    allDay,
    startsAt: allDay ? allDayToLocal(row.startsAt) : row.startsAt,
    endsAt: allDay ? allDayToLocal(row.endsAt) : row.endsAt,
  };
}

/** SPEC F2: a partiful.com link anywhere in an event makes it a Partiful event. */
const partiful = (...texts: (string | null)[]) => (/partiful\.com/i.test(texts.join(' ')) ? 1 : 0);

/**
 * Every event, in no particular order. All-day dates come back as this phone's days.
 * An imported event the owner deleted is still stored, and is left out.
 */
export function listEvents(): StoredEvent[] {
  return db()
    .getAllSync<EventRow>(
      `SELECT id, source, sourceId, title, startsAt, endsAt, allDay, locationText, lat, lng,
        geocodeStatus, url, host, description, isPartiful, notes, keyDetails, photo,
        removedFromSource
      FROM events WHERE deletedAt IS NULL`,
    )
    .map((row) => ({
      ...row,
      ...localTimes(row),
      isPartiful: row.isPartiful === 1,
      keyDetails: JSON.parse(row.keyDetails) as string[],
      removedFromSource: row.removedFromSource === 1,
    }));
}

/**
 * Adds an event, or with `id` updates the fields the form edits and nothing else.
 * `fields.photo` is the photo's stored file name here (see src/data/events.ts).
 * Where the place is goes with the address: change the address and it is looked up
 * again, keep it and what was found stays. An address picked from the suggestions
 * brings its place with it (`fields.place`), and is not looked up at all.
 */
export function saveEvent(fields: EventFields, id?: string): void {
  const { allDay } = fields;
  const place = isPlace(fields.place) ? fields.place : null;
  const description = fields.description ?? '';
  db().runSync(
    `INSERT INTO events (id, source, sourceId, title, startsAt, endsAt, allDay, timeZone,
      locationText, lat, lng, geocodeStatus, url, host, description, isPartiful, notes,
      keyDetails, photo, createdAt, updatedAt)
    VALUES (coalesce($id, lower(hex(randomblob(16)))), 'manual', $sourceId, $title, $startsAt,
      $endsAt, $allDay, $timeZone, $locationText, $lat, $lng,
      CASE WHEN $lat IS NULL THEN 'pending' ELSE 'located' END, $url, $host, $description,
      $isPartiful, $notes, $keyDetails, $photo, $now, $now)
    ON CONFLICT (id) DO UPDATE SET
      title = excluded.title,
      startsAt = excluded.startsAt,
      endsAt = excluded.endsAt,
      allDay = excluded.allDay,
      locationText = excluded.locationText,
      lat = CASE WHEN excluded.lat IS NOT NULL THEN excluded.lat
        WHEN excluded.locationText = events.locationText THEN events.lat END,
      lng = CASE WHEN excluded.lat IS NOT NULL THEN excluded.lng
        WHEN excluded.locationText = events.locationText THEN events.lng END,
      geocodeStatus = CASE WHEN excluded.lat IS NOT NULL THEN 'located'
        WHEN excluded.locationText = events.locationText THEN events.geocodeStatus
        ELSE 'pending' END,
      url = excluded.url,
      host = excluded.host,
      notes = excluded.notes,
      photo = excluded.photo,
      isPartiful = excluded.isPartiful OR events.description LIKE '%partiful.com%',
      updatedAt = excluded.updatedAt`,
    {
      $id: id ?? null,
      $sourceId: fields.sourceId ?? null,
      $title: fields.title,
      $startsAt: allDay ? allDayToUtc(fields.startsAt) : fields.startsAt,
      $endsAt: allDay ? allDayToUtc(fields.endsAt) : fields.endsAt,
      $allDay: allDay ? 1 : 0,
      $timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      $locationText: fields.locationText,
      $lat: place?.lat ?? null,
      $lng: place?.lng ?? null,
      $url: fields.url,
      $host: fields.host,
      $description: description,
      $isPartiful: partiful(fields.url, description, fields.locationText),
      $notes: fields.notes,
      $keyDetails: JSON.stringify(fields.keyDetails ?? []),
      $photo: fields.photo ?? null,
      $now: Date.now(),
    },
  );
}

/**
 * An event added by hand is gone for good. An imported one is kept out of sight so that
 * the next sync does not bring it back, and only what tells it apart is kept: its key,
 * title and times. Everything else, the owner's notes and photo included, is wiped.
 */
export function deleteEvent(id: string): void {
  // Only one of these finds anything to do.
  db().runSync(`DELETE FROM events WHERE id = ? AND source = 'manual'`, [id]);
  db().runSync(
    `UPDATE events SET deletedAt = ?, description = '', locationText = '', host = '', url = NULL,
      photo = NULL, notes = '', lat = NULL, lng = NULL, geocodeStatus = 'pending', isPartiful = 0,
      tags = '[]', checklist = '[]', keyDetails = '[]', reminderOffsets = NULL
    WHERE id = ?`,
    [Date.now(), id],
  );
}

export function deleteSampleEvents(): void {
  // Only ones added by hand: a calendar file is free to use the same words in a key.
  db().runSync(
    `DELETE FROM events WHERE source = 'manual' AND sourceId LIKE '${SAMPLE_PREFIX}%'`,
  );
}

/** Swaps whatever samples are stored for these, so pressing the button twice never doubles them. */
export function replaceSampleEvents(samples: EventFields[]): void {
  db().withTransactionSync(() => {
    deleteSampleEvents();
    samples.forEach((sample) => saveEvent(sample));
  });
}

type ExistingRow = Omit<ExistingEvent, 'allDay' | 'removedFromSource' | 'deleted'> & {
  allDay: number;
  removedFromSource: number;
  deleted: number;
};

/**
 * Brings in what a calendar or a file holds, by the rules in src/lib/importPlan.ts:
 * new events are added, changed ones updated, and ones a calendar no longer has are
 * marked instead of deleted. Only what the calendar owns is written, so notes, photos
 * and key details stay as they are. All of it is saved, or none of it.
 */
export function importEvents(
  incoming: ImportedEvent[],
  scope: ImportScope,
  now = Date.now(),
): ImportResult & { wrote: boolean } {
  const existing = db()
    .getAllSync<ExistingRow>(
      `SELECT id, sourceId, title, startsAt, endsAt, allDay, locationText, host, url, description,
        removedFromSource, deletedAt IS NOT NULL AS deleted
      FROM events WHERE source = ? AND sourceId IS NOT NULL`,
      [scope.source],
    )
    .map((row) => ({
      ...row,
      ...localTimes(row),
      removedFromSource: row.removedFromSource === 1,
      deleted: row.deleted === 1,
    }));
  const plan = planImport(existing, incoming, scope);

  const owned = (event: ImportedEvent) => ({
    $sourceId: event.sourceId,
    $title: event.title,
    $startsAt: event.allDay ? allDayToUtc(event.startsAt) : event.startsAt,
    $endsAt: event.allDay ? allDayToUtc(event.endsAt) : event.endsAt,
    $allDay: event.allDay ? 1 : 0,
    $locationText: event.locationText,
    $url: event.url,
    $host: event.host,
    $description: event.description,
    $isPartiful: partiful(event.url, event.description, event.locationText),
    $now: now,
  });

  // ponytail: each row prepares its statement afresh, fine for a few thousand events;
  // prepare each statement once if a first import ever feels slow.
  // ponytail: lastSyncedAt is only written when a sync adds or changes a row, and
  // nothing reads it yet; stamp every row a sync saw once something needs to know.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  db().withTransactionSync(() => {
    for (const event of plan.inserts) {
      db().runSync(
        `INSERT INTO events (id, source, sourceId, title, startsAt, endsAt, allDay, timeZone,
          locationText, url, host, description, isPartiful, createdAt, updatedAt, lastSyncedAt)
        VALUES (lower(hex(randomblob(16))), $source, $sourceId, $title, $startsAt, $endsAt,
          $allDay, $timeZone, $locationText, $url, $host, $description, $isPartiful, $now, $now,
          $now)`,
        { ...owned(event), $source: scope.source, $timeZone: timeZone },
      );
    }
    for (const { id, event, relocate } of plan.updates) {
      db().runSync(
        `UPDATE events SET
          sourceId = $sourceId,
          title = $title,
          startsAt = $startsAt,
          endsAt = $endsAt,
          allDay = $allDay,
          locationText = $locationText,
          url = $url,
          host = $host,
          description = $description,
          isPartiful = $isPartiful,
          removedFromSource = 0,
          updatedAt = $now,
          lastSyncedAt = $now,
          lat = CASE WHEN $relocate THEN NULL ELSE lat END,
          lng = CASE WHEN $relocate THEN NULL ELSE lng END,
          geocodeStatus = CASE WHEN $relocate THEN 'pending' ELSE geocodeStatus END
        WHERE id = $id`,
        { ...owned(event), $id: id, $relocate: relocate ? 1 : 0 },
      );
    }
    for (const { id, sourceId } of plan.rekeys) {
      db().runSync('UPDATE events SET sourceId = ? WHERE id = ?', [sourceId, id]);
    }
    for (const id of plan.removed) {
      db().runSync('UPDATE events SET removedFromSource = 1, updatedAt = ? WHERE id = ?', [now, id]);
    }
  });
  const { inserts, updates, rekeys, removed } = plan;
  // Whether anything was written, so the screens are only reloaded when it was.
  return { ...plan.result, wrote: inserts.length + updates.length + rekeys.length + removed.length > 0 };
}

// Where an event is. The address is looked up elsewhere; this is where the answer is kept.

/**
 * The next address to look up, or null when there is none. Before choosing, every
 * waiting event whose exact address has been answered before is given that answer, so
 * no address is ever asked for twice; `reused` is how many events that filled in.
 */
export function nextPendingAddress(now = Date.now()): { address: string | null; reused: number } {
  const reused = db().runSync(
    `UPDATE events SET lat = known.lat, lng = known.lng, geocodeStatus = known.geocodeStatus
    FROM events AS known
    WHERE events.geocodeStatus = 'pending' AND known.geocodeStatus != 'pending'
      AND known.locationText = events.locationText`,
  ).changes;
  // Only what is needed is sent: events still to come that are still in their
  // calendar, the soonest first. Sample events are invented, so their addresses are
  // never sent anywhere.
  const next = db().getFirstSync<{ locationText: string }>(
    `SELECT locationText FROM events
    WHERE deletedAt IS NULL AND geocodeStatus = 'pending' AND trim(locationText) != ''
      AND endsAt > $now AND removedFromSource = 0
      AND NOT (source = 'manual' AND ifnull(sourceId, '') LIKE '${SAMPLE_PREFIX}%')
    ORDER BY startsAt
    LIMIT 1`,
    { $now: now },
  );
  return { address: next?.locationText ?? null, reused };
}

/** Records the answer for an address, on every event that is waiting for it. Null: not found. */
export function setGeocode(address: string, found: { lat: number; lng: number } | null): void {
  // A place off the map is no place: "located" must always mean there is somewhere to go.
  const place = found && Math.abs(found.lat) <= 90 && Math.abs(found.lng) <= 180 ? found : null;
  db().runSync(
    `UPDATE events SET lat = $lat, lng = $lng, geocodeStatus = $status
    WHERE geocodeStatus = 'pending' AND locationText = $address`,
    {
      $lat: place?.lat ?? null,
      $lng: place?.lng ?? null,
      $status: place ? 'located' : 'notFound',
      $address: address,
    },
  );
}

// Walking routes, kept so the same walk is not asked for twice. They hold where the
// owner has been, so they stay on the phone, few and not for long.

/** A kept route is used for a start within this of where it was asked from. */
export const ROUTE_FROM_M = 75;
/** And for a venue within this of the one it was asked for. */
const ROUTE_TO_M = 25;
/** Paths and pavements change; after this a route is asked for again. */
export const ROUTE_KEEP_MS = 14 * 24 * 3_600_000;
/** At most this many are kept, the newest. */
const ROUTES_KEPT = 40;
/** About 25 m of latitude, to narrow the search before measuring. */
const NEAR_DEG = 0.00025;

type RouteRow = {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  distance: number;
  duration: number;
  line: string;
  steps: string;
  fetchedAt: number;
};

/** The newest kept route that fits this walk, or null. */
export function findRoute(from: LatLng, to: LatLng, now = Date.now()): WalkingRoute | null {
  const rows = db().getAllSync<RouteRow>(
    `SELECT fromLat, fromLng, toLat, toLng, distance, duration, line, steps, fetchedAt
    FROM routes WHERE toLat BETWEEN $low AND $high AND fetchedAt > $since
    ORDER BY fetchedAt DESC`,
    { $low: to.lat - NEAR_DEG, $high: to.lat + NEAR_DEG, $since: now - ROUTE_KEEP_MS },
  );
  const row = rows.find(
    (r) =>
      distance(to, { lat: r.toLat, lng: r.toLng }) <= ROUTE_TO_M &&
      distance(from, { lat: r.fromLat, lng: r.fromLng }) <= ROUTE_FROM_M,
  );
  if (!row) return null;
  return {
    from: { lat: row.fromLat, lng: row.fromLng },
    to: { lat: row.toLat, lng: row.toLng },
    line: (JSON.parse(row.line) as [number, number][]).map(([lat, lng]) => ({ lat, lng })),
    distance: row.distance,
    duration: row.duration,
    steps: JSON.parse(row.steps),
    fetchedAt: row.fetchedAt,
  };
}

/** Keeps a route, and lets go of old ones and any past the newest few. */
export function keepRoute(route: WalkingRoute): void {
  db().withTransactionSync(() => {
    db().runSync(
      `INSERT INTO routes (fromLat, fromLng, toLat, toLng, distance, duration, line, steps,
        fetchedAt)
      VALUES ($fromLat, $fromLng, $toLat, $toLng, $distance, $duration, $line, $steps, $fetchedAt)`,
      {
        $fromLat: route.from.lat,
        $fromLng: route.from.lng,
        $toLat: route.to.lat,
        $toLng: route.to.lng,
        $distance: route.distance,
        $duration: route.duration,
        // Pairs, not objects: a long route is a few thousand points.
        $line: JSON.stringify(route.line.map((p) => [p.lat, p.lng])),
        $steps: JSON.stringify(route.steps),
        $fetchedAt: route.fetchedAt,
      },
    );
    db().runSync(
      `DELETE FROM routes WHERE fetchedAt <= $since OR id NOT IN (
        SELECT id FROM routes ORDER BY fetchedAt DESC, id DESC LIMIT ${ROUTES_KEPT})`,
      { $since: route.fetchedAt - ROUTE_KEEP_MS },
    );
  });
}

/** Every event, every setting and every kept route. Settings go back to their defaults. */
export function deleteAllData(): void {
  db().withTransactionSync(() => {
    db().execSync(
      'DELETE FROM events; DELETE FROM routes; DELETE FROM settings; INSERT INTO settings (id) VALUES (1);',
    );
  });
}

// Settings

const SETTINGS_KEYS = [
  'defaultOffsets',
  'digestEnabled',
  'digestTime',
  'weeklyPreviewEnabled',
  'importCalendarIds',
  'onlyPartifulLinks',
  'units',
  'onboardingDone',
  'walkSafetySeen',
  'simulateWalk',
  'recordWalks',
] as const satisfies readonly (keyof Settings)[];

export function getSettings(): Settings {
  const row = db().getFirstSync<Record<keyof Settings, string | number>>(
    `SELECT ${SETTINGS_KEYS.join(', ')} FROM settings WHERE id = 1`,
  );
  if (!row) throw new Error('The settings row is missing.');
  return {
    defaultOffsets: JSON.parse(String(row.defaultOffsets)),
    digestEnabled: row.digestEnabled === 1,
    digestTime: Number(row.digestTime),
    weeklyPreviewEnabled: row.weeklyPreviewEnabled === 1,
    importCalendarIds: JSON.parse(String(row.importCalendarIds)),
    onlyPartifulLinks: row.onlyPartifulLinks === 1,
    units: row.units === 'km' ? 'km' : 'mi',
    onboardingDone: row.onboardingDone === 1,
    walkSafetySeen: row.walkSafetySeen === 1,
    simulateWalk: row.simulateWalk === 1,
    recordWalks: row.recordWalks === 1,
  };
}

export function updateSettings(patch: Partial<Settings>): void {
  for (const key of SETTINGS_KEYS) {
    const value = patch[key];
    if (value === undefined) continue;
    db().runSync(`UPDATE settings SET ${key} = ? WHERE id = 1`, [
      typeof value === 'object' ? JSON.stringify(value) : typeof value === 'boolean' ? +value : value,
    ]);
  }
}
