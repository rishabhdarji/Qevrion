import * as Notifications from 'expo-notifications';
import { IosAuthorizationStatus } from 'expo-notifications';
import { useEffect } from 'react';

import type { FireTime, Pending } from './reminders';

// The only file that talks to the iPhone's notifications (`expo-notifications`). Local
// notifications only: nothing is registered for push and nothing leaves the phone.
// Checked against the SDK 58 package for Expo Go: scheduling, listing, cancelling,
// asking permission and hearing about taps all work there; they arrive under Expo Go's
// name and icon, and the 64 that iOS holds are shared with other projects opened in
// Expo Go. The desktop preview loads notifier.web.ts instead.

/** Whether the app may show notifications. */
export type ReminderAccess =
  /** Never asked. A button may put the iPhone's question. */
  | 'ask'
  | 'granted'
  /** Said no, or turned off: only the Settings app can change it. */
  | 'denied';

/** A tap on one of the app's notifications. */
export type Tap = { eventId: string | null };

/** A notification iOS holds, with what the debug panel shows of it. */
export type Held = Pending & {
  title: string;
  /** Null when iOS holds something this app did not label. */
  fireAt: number | null;
  kind: string | null;
};

/** What every notification carries, so a tap knows where to go and a listing knows whose it is. */
type Tag = { qevrion: 1; kind: string; eventId: string | null; fireAt: number };

const tagOf = (data: unknown): Tag | null =>
  data && typeof data === 'object' && (data as Tag).qevrion === 1 ? (data as Tag) : null;

// A reminder that fires while the app is open is shown like any other; iOS shows
// nothing for a foreground app unless told to.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function toAccess(permission: Notifications.NotificationPermissionsStatus): ReminderAccess {
  // "Deliver quietly" still delivers, to the notification list.
  const quiet = permission.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  if (permission.granted || quiet) return 'granted';
  return permission.canAskAgain ? 'ask' : 'denied';
}

export async function readAccess(): Promise<ReminderAccess> {
  return toAccess(await Notifications.getPermissionsAsync());
}

/** Puts the iPhone's own question. Banners and sound; no badge on the icon. */
export async function requestAccess(): Promise<ReminderAccess> {
  return toAccess(
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    }),
  );
}

/** Everything iOS is holding for the app, soonest first. */
export async function held(): Promise<Held[]> {
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  return requests
    .map((request) => {
      const tag = tagOf(request.content.data);
      return {
        osNotificationId: request.identifier,
        ours: tag !== null,
        test: tag?.kind === 'test',
        title: request.content.title ?? '',
        fireAt: tag?.fireAt ?? null,
        kind: tag?.kind ?? null,
      };
    })
    .sort((a, b) => (a.fireAt ?? Infinity) - (b.fireAt ?? Infinity));
}

/** Hands one notification to iOS, and resolves to the id iOS knows it by. */
export function schedule(fire: FireTime): Promise<string> {
  const { kind, eventId, fireAt } = fire;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: fire.title,
      body: fire.body,
      sound: true,
      data: { qevrion: 1, kind, eventId, fireAt } satisfies Tag,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
}

/** The Settings test: fires once, `seconds` from now, and opens `eventId` when tapped. */
export function scheduleTest(
  content: { title: string; body: string; eventId: string | null },
  seconds: number,
): Promise<string> {
  const fireAt = Date.now() + seconds * 1000;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      sound: true,
      data: { qevrion: 1, kind: 'test', eventId: content.eventId, fireAt } satisfies Tag,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}

export const cancel = (osNotificationId: string): Promise<void> =>
  Notifications.cancelScheduledNotificationAsync(osNotificationId);

/** Calls `listener` when a notification arrives while the app is open. */
export function onDelivered(listener: () => void): void {
  Notifications.addNotificationReceivedListener(listener);
}

/**
 * Calls `onTap` once for each tap on one of the app's notifications: while the app is
 * open, in the background, or closed. For a closed app, Expo's documentation says to
 * read the last response at start-up; the hook used here does both.
 */
export function useNotificationTap(onTap: (tap: Tap) => void): void {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const tag = tagOf(response.notification.request.content.data);
    // Cleared at once, so the same tap is never acted on twice.
    Notifications.clearLastNotificationResponse();
    if (tag) onTap({ eventId: typeof tag.eventId === 'string' ? tag.eventId : null });
  }, [response, onTap]);
}
