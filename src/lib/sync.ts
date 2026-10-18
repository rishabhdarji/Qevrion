import * as Calendar from 'expo-calendar/legacy';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import { getSettings } from '../data/db';
import { importEvents } from '../data/events';
import type { ImportResult } from '../types';
import { collect } from './calendarImport';
import { dayStart, startOfDay } from './dates';
import { locateVenues } from './geocode';
import { parseIcs } from './ics';

// Brings events in: from the calendars chosen on the import screen, re-read on every
// app open and pull-to-refresh, and from a calendar file once. Nothing read here
// leaves the phone, and nothing is logged.

const MAX_FILE_BYTES = 2 * 1024 * 1024;
/** iOS says the app is active often, on every return from a system box. */
const QUIET_MS = 60_000;

/** The dates a sync reads (SPEC F2): 30 days back to 12 months ahead, from the start of today. */
export function syncWindow(now = Date.now()): { from: number; to: number } {
  const today = new Date(dayStart(now));
  return {
    from: dayStart(today.getTime(), -30),
    to: startOfDay(today.getFullYear() + 1, today.getMonth(), today.getDate()),
  };
}

const NOTHING: ImportResult = { added: 0, updated: 0, unchanged: 0, skipped: 0 };

let running: Promise<ImportResult | null> | undefined;
let finishedAt = -Infinity;

/** Reads the chosen calendars once. Null when there is nothing it may or can read. */
async function readCalendars(): Promise<ImportResult | null> {
  if (Platform.OS === 'web') return null;
  // Only ever looks: asking is the import screen's job, after it has said why.
  if (!(await Calendar.getCalendarPermissionsAsync()).granted) return null;
  const { importCalendarIds, onlyPartifulLinks } = getSettings();
  if (importCalendarIds.length === 0) return null;
  const listed = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  // A calendar deleted on the phone is skipped, and so are its events: only a
  // calendar that was read can say an event is gone.
  const calendarIds = importCalendarIds.filter((id) => listed.some((calendar) => calendar.id === id));
  if (calendarIds.length === 0) return null;
  const { from, to } = syncWindow();
  const events = await Calendar.getEventsAsync(calendarIds, new Date(from), new Date(to));
  // A calendar that answers with nothing at all is taken to be still loading, not
  // emptied, so it cannot mark every event "Removed from calendar".
  // ponytail: so a calendar that really is emptied never marks its events removed;
  // compare with what the calendar held last time if that ever matters.
  if (events.length === 0) return NOTHING;
  const { incoming, present, filtered } = collect(events, onlyPartifulLinks);
  const result = importEvents(incoming, { source: 'calendar', calendarIds, from, to, present });
  locateVenues();
  return { ...result, skipped: result.skipped + filtered };
}

/**
 * Re-reads the chosen calendars. Null, having done nothing, on the web, without
 * calendar access, with no chosen calendar left, or when a sync finished under a
 * minute ago (`force` skips that wait). Throws what went wrong: callers that run
 * unseen catch it and stay quiet.
 */
export function syncCalendars({ force = false } = {}): Promise<ImportResult | null> {
  if (running) {
    // One at a time. A forced sync waits for the one under way and then reads
    // afresh: it may come straight after new calendars were chosen.
    const again = () => syncCalendars({ force });
    return force ? running.then(again, again) : running;
  }
  if (!force && Date.now() - finishedAt < QUIET_MS) return Promise.resolve(null);
  running = readCalendars().finally(() => {
    running = undefined;
    finishedAt = Date.now();
  });
  return running;
}

/**
 * Brings in a calendar file. `repeating` is how many repeating events were left out.
 * Throws an error fit to show when the file is too big, unreadable or not a calendar.
 */
export async function importFile(uri: string): Promise<ImportResult & { repeating: number }> {
  const file = new File(uri);
  // Measured before reading, so a huge file is never loaded into memory.
  if (file.size > MAX_FILE_BYTES) throw new Error('This file is too big to import.');
  let fileText: string;
  try {
    fileText = await file.text();
  } catch {
    throw new Error('This file could not be read.');
  }
  const { events, skipped, repeating } = parseIcs(fileText);
  const result = importEvents(events, { source: 'ics' });
  locateVenues();
  return { ...result, skipped: result.skipped + skipped, repeating };
}

/** Pull-to-refresh for a list: re-reads the calendars, and says so if that fails. */
export function useSyncRefresh(): { refreshing: boolean; onRefresh: () => void } {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    syncCalendars({ force: true })
      .catch((error: unknown) =>
        Alert.alert('Could not refresh', error instanceof Error ? error.message : String(error)),
      )
      .finally(() => setRefreshing(false));
  };
  return { refreshing, onRefresh };
}
