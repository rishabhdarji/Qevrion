import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { allDayToLocal, allDayToUtc } from '../lib/dates';
import type { EventFields, QevrionEvent, Settings } from '../types';

// The only file that talks to SQLite. Screens never import this for events; they go
// through src/data/events.ts, which keeps what is read here in memory.
//
// Calls are synchronous on purpose: a few hundred small rows take a few milliseconds,
// and nothing above this file has to deal with a loading state.

// One entry per schema version, run in order. Never edit an entry that has shipped:
// to change the schema, add a new one. Version 1 is SPEC section 7 (Event, Settings).
// Lists are JSON text and yes/no values are 0 or 1.
const MIGRATIONS = [
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

export type StoredEvent = Omit<QevrionEvent, 'isSample' | 'cover' | 'hasConflict'> & {
  sourceId: string | null;
};

type EventRow = Omit<StoredEvent, 'allDay' | 'isPartiful' | 'keyDetails'> & {
  allDay: number;
  isPartiful: number;
  keyDetails: string;
};

/** Every event, in no particular order. All-day dates come back as this phone's days. */
export function listEvents(): StoredEvent[] {
  return db()
    .getAllSync<EventRow>(
      `SELECT id, source, sourceId, title, startsAt, endsAt, allDay, locationText, url, host,
        description, isPartiful, notes, keyDetails
      FROM events`,
    )
    .map((row) => {
      const allDay = row.allDay === 1;
      return {
        ...row,
        allDay,
        startsAt: allDay ? allDayToLocal(row.startsAt) : row.startsAt,
        endsAt: allDay ? allDayToLocal(row.endsAt) : row.endsAt,
        isPartiful: row.isPartiful === 1,
        keyDetails: JSON.parse(row.keyDetails) as string[],
      };
    });
}

/** Adds an event, or with `id` updates the fields the form edits and nothing else. */
export function saveEvent(fields: EventFields, id?: string): void {
  const { allDay } = fields;
  const description = fields.description ?? '';
  db().runSync(
    `INSERT INTO events (id, source, sourceId, title, startsAt, endsAt, allDay, timeZone,
      locationText, url, host, description, isPartiful, notes, keyDetails, createdAt, updatedAt)
    VALUES (coalesce($id, lower(hex(randomblob(16)))), 'manual', $sourceId, $title, $startsAt,
      $endsAt, $allDay, $timeZone, $locationText, $url, $host, $description, $isPartiful, $notes,
      $keyDetails, $now, $now)
    ON CONFLICT (id) DO UPDATE SET
      title = excluded.title,
      startsAt = excluded.startsAt,
      endsAt = excluded.endsAt,
      allDay = excluded.allDay,
      locationText = excluded.locationText,
      url = excluded.url,
      host = excluded.host,
      notes = excluded.notes,
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
      $url: fields.url,
      $host: fields.host,
      $description: description,
      $isPartiful: /partiful\.com/i.test(`${fields.url} ${description}`) ? 1 : 0,
      $notes: fields.notes,
      $keyDetails: JSON.stringify(fields.keyDetails ?? []),
      $now: Date.now(),
    },
  );
}

export function deleteEvent(id: string): void {
  db().runSync('DELETE FROM events WHERE id = ?', [id]);
}

export function deleteSampleEvents(): void {
  db().runSync(`DELETE FROM events WHERE sourceId LIKE '${SAMPLE_PREFIX}%'`);
}

/** Swaps whatever samples are stored for these, so pressing the button twice never doubles them. */
export function replaceSampleEvents(samples: EventFields[]): void {
  db().withTransactionSync(() => {
    deleteSampleEvents();
    samples.forEach((sample) => saveEvent(sample));
  });
}

/** Every event and every setting. Settings go back to their defaults. */
export function deleteAllData(): void {
  db().withTransactionSync(() => {
    db().execSync('DELETE FROM events; DELETE FROM settings; INSERT INTO settings (id) VALUES (1);');
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
