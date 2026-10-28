import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { LatLng } from './geo';

// Where the owner is, only while the app is open ("while using the app"; the app
// never asks for more). The question is put only when a screen needs the answer and
// the owner has pressed a button that says why (just in time). Nothing here asks on
// its own.

export type LocationAccess =
  /** Not yet known: being checked. */
  | 'checking'
  /** Never asked. The button may ask. */
  | 'ask'
  | 'granted'
  /** Said no, or turned off for this app: only the Settings app can change it. */
  | 'denied'
  /** Location Services are off for the whole phone. */
  | 'servicesOff';

async function readAccess(): Promise<LocationAccess> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.granted) {
    return (await Location.hasServicesEnabledAsync()) ? 'granted' : 'servicesOff';
  }
  return permission.canAskAgain ? 'ask' : 'denied';
}

/**
 * Whether the app may know where the owner is, checked again whenever the app comes
 * back to the front, as it does from the Settings app. `ask` puts the iPhone's question.
 */
export function useLocationAccess(): { access: LocationAccess; ask: () => Promise<void> } {
  const [access, setAccess] = useState<LocationAccess>('checking');

  const check = useCallback(() => {
    readAccess()
      .then(setAccess)
      .catch(() => setAccess('denied'));
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => sub.remove();
  }, [check]);

  const ask = useCallback(async () => {
    try {
      // "While using the app" only: never the background question.
      await Location.requestForegroundPermissionsAsync();
    } finally {
      check();
    }
  }, [check]);

  return { access, ask };
}

export type Position = LatLng & {
  /** Metres either way. */
  accuracy: number | null;
  /** When the phone took the fix, in milliseconds since 1970. */
  at: number;
};

const toPosition = (fix: Location.LocationObject): Position => ({
  lat: fix.coords.latitude,
  lng: fix.coords.longitude,
  accuracy: fix.coords.accuracy ?? null,
  at: fix.timestamp,
});

/**
 * Where the owner is, followed while the screen is in front and `enabled`, and let go
 * of when it is not, so the GPS is never left running. Starts with the last place the
 * phone knew if it is recent, so the map does not wait for a fresh fix. A new position
 * comes every `everyMetres`; `best` asks for the GPS's finest, which AR Walk needs and
 * the map does not.
 */
export function usePosition(
  enabled: boolean,
  { everyMetres = 15, best = false }: { everyMetres?: number; best?: boolean } = {},
): Position | null {
  const [position, setPosition] = useState<Position | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let active = true;
      let watch: Location.LocationSubscription | undefined;
      Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 200 })
        .then((fix) => active && fix && setPosition((now) => now ?? toPosition(fix)))
        .catch(() => {});
      Location.watchPositionAsync(
        {
          accuracy: best ? Location.Accuracy.BestForNavigation : Location.Accuracy.High,
          distanceInterval: everyMetres,
        },
        (fix) => active && setPosition(toPosition(fix)),
      )
        .then((subscription) => {
          if (active) watch = subscription;
          else subscription.remove();
        })
        .catch(() => {});
      return () => {
        active = false;
        watch?.remove();
      };
    }, [enabled, everyMetres, best]),
  );

  return enabled ? position : null;
}

/** How long a rough fix for the suggestions may take before they go ahead without one. */
const ROUGH_FIX_MS = 4000;

/**
 * Roughly where the owner is, for ranking address suggestions, only if they have
 * already said yes. Never asks. The last place the phone knew, or else a quick rough
 * fix from Wi-Fi and cell towers; null if neither comes in time.
 */
export async function placeIfAllowed(): Promise<LatLng | null> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const fix =
      (await Location.getLastKnownPositionAsync({ maxAge: 60 * 60_000 })) ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ROUGH_FIX_MS)),
      ]));
    return fix ? { lat: fix.coords.latitude, lng: fix.coords.longitude } : null;
  } catch {
    return null;
  }
}
