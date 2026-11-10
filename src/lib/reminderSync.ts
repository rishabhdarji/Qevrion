import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { getSettings, listScheduled, replaceScheduled, updateSettings } from '../data/db';
import { getEvents, onEventsChanged } from '../data/events';
import * as notifier from './notifier';
import type { Held, ReminderAccess } from './notifier';
import { buildFireTimes, reconcile } from './reminders';

// Runs the reminder scheduler (src/lib/reminders.ts) against the real iPhone and the
// real database, and keeps the screens told whether notifications are allowed.
//
// SPEC section 8, rule 3: the scheduler runs when the app opens or comes back to the
// front (src/app/_layout.tsx), after any import or event edit (every change to the
// events lands here), after a settings edit (the screens call `syncReminders`), when
// a notification is tapped, and when one arrives while the app is open.

// One job at a time, in the order asked: two runs at once would each schedule the
// same reminder.
let line: Promise<unknown> = Promise.resolve();
let waiting = false;

function inLine<T>(job: () => Promise<T>): Promise<T | undefined> {
  const next = line.then(job).catch(() => undefined);
  line = next;
  return next;
}

const scheduleListeners = new Set<() => void>();

async function run(reserve = 0): Promise<void> {
  const access = await refreshAccess();
  await reconcile({
    events: getEvents(),
    settings: getSettings(),
    now: Date.now(),
    allowed: access === 'granted',
    os: { pending: notifier.held, schedule: notifier.schedule, cancel: notifier.cancel },
    store: { list: listScheduled, replace: replaceScheduled },
    reserve,
  });
  scheduleListeners.forEach((listener) => listener());
}

/**
 * Brings what iOS holds in step with the events and settings. Cheap to call often:
 * calls made while one is waiting to start share it, and a run that finds nothing
 * changed schedules and cancels nothing. Never throws; a failed run is tried again by
 * the next.
 */
export function syncReminders(): Promise<void> {
  if (!waiting) {
    waiting = true;
    inLine(() => {
      waiting = false;
      return run();
    });
  }
  return line.then(() => undefined);
}

/** Calls `listener` after each run of the scheduler, until the returned function is called. */
export function onScheduleChanged(listener: () => void): () => void {
  scheduleListeners.add(listener);
  return () => {
    scheduleListeners.delete(listener);
  };
}

export type ScheduleSnapshot = {
  /** Everything iOS holds for the app, soonest first. */
  held: Held[];
  /** Every future fire time there is, of which only the nearest are scheduled. */
  planned: number;
};

/** For the debug panel: what iOS holds right now, read from iOS itself. */
export async function readSchedule(): Promise<ScheduleSnapshot> {
  return {
    held: await notifier.held(),
    planned: buildFireTimes(getEvents(), getSettings(), Date.now()).length,
  };
}

/** The event a test notification opens: the next one still to come, if there is one. */
export function testTarget(now = Date.now()) {
  const upcoming = getEvents().filter((event) => !event.removedFromSource);
  return upcoming.find((event) => event.startsAt > now) ?? upcoming.find((event) => event.endsAt > now);
}

/**
 * Sends one notification `seconds` from now. A place is freed for it first, so iOS
 * never holds more than the limit; the next run of the scheduler takes it back.
 * False when notifications are not allowed.
 */
export async function sendTestNotification(seconds = 10): Promise<boolean> {
  const sent = await inLine(async () => {
    if ((await notifier.readAccess()) !== 'granted') return false;
    await run(1);
    const event = testTarget();
    await notifier.scheduleTest(
      {
        title: 'Qevrion test notification',
        body: event ? `Tap to open "${event.title}".` : 'Tap to open Qevrion. There is no event to open yet.',
        eventId: event?.id ?? null,
      },
      seconds,
    );
    scheduleListeners.forEach((listener) => listener());
    return true;
  });
  return sent === true;
}

// Whether notifications are allowed, and whether the owner has been asked. Shared, so
// Home's banner, Settings and the permission screen always agree.

export type ReminderState = {
  /** `checking` until the iPhone has answered, which takes a moment. */
  access: ReminderAccess | 'checking';
  /** The permission screen has been shown, or passed by in the welcome screens. */
  asked: boolean;
};

let state: ReminderState = { access: 'checking', asked: false };
const stateListeners = new Set<() => void>();

function setState(next: ReminderState) {
  if (next.access === state.access && next.asked === state.asked) return;
  state = next;
  stateListeners.forEach((listener) => listener());
}

async function refreshAccess(): Promise<ReminderAccess> {
  let access: ReminderAccess;
  try {
    access = await notifier.readAccess();
  } catch {
    // Unreadable: as if off, and the next look tries again.
    access = 'denied';
  }
  setState({ access, asked: getSettings().remindersAsked });
  return access;
}

/** Whether notifications are allowed and whether the owner has been asked, kept up to date. */
export function useReminderState(): ReminderState {
  return useSyncExternalStore(
    (listener) => {
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
    () => state,
  );
}

/** Records that the owner has seen the question, or said "Not now" to it. */
export function markRemindersAsked(): void {
  updateSettings({ remindersAsked: true });
  setState({ ...state, asked: true });
}

/** Puts the iPhone's own question, then schedules if the answer was yes. */
export async function askForReminders(): Promise<ReminderAccess> {
  markRemindersAsked();
  let access: ReminderAccess;
  try {
    access = await notifier.requestAccess();
  } catch {
    access = 'denied';
  }
  setState({ access, asked: true });
  syncReminders();
  return access;
}

// Any change to the events, "Delete all data" included, is a reason to run again.
onEventsChanged(() => {
  syncReminders();
});
// One that arrives while the app is open has left a place free for the next in line.
notifier.onDelivered(() => {
  syncReminders();
});
// Back from the Settings app, the answer may have changed. The root layout runs the
// scheduler on the same signal; this keeps the screens right even before it has.
AppState.addEventListener('change', (next) => {
  if (next === 'active') refreshAccess();
});
