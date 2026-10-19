import * as Location from 'expo-location';
import { AppState, Platform } from 'react-native';

import { nextPendingAddress, setGeocode, showLocations } from '../data/events';

// Finds where each event's address is on the map, with the iPhone's own geocoder: no
// key, and no location permission, but it needs the network and Apple limits how fast
// it may be asked, with no number published. So one address at a time, a pause
// between them, and only while the app is open. Only the address is sent, and only
// for events still to come (src/data/db.ts). What is found is kept, and no address is
// ever asked for twice.

const PAUSE_MS = 1500;
/** The screens are redrawn after this many answers, and when the queue stops. */
const SHOW_EVERY = 5;
/**
 * A link in the place field, such as a video call with its passcode or a private
 * invitation, is nobody's address and is never sent.
 */
const LINK = /[a-z][a-z0-9+.-]*:\/\//i;
/**
 * What expo-location's iOS code throws when the geocoder reports a network failure,
 * which is also how Apple says "too many requests" (`Exceptions.GeocodingNetwork`).
 */
const NETWORK = 'ERR_GEOCODING_NETWORK';

let running = false;

async function work(): Promise<void> {
  let unshown = 0;
  try {
    // A box from the system makes the app "inactive" for a moment; it is still open.
    while (AppState.currentState !== 'background') {
      const address = nextPendingAddress();
      if (!address) return;
      if (LINK.test(address)) {
        setGeocode(address, null);
      } else {
        let found: Location.LocationGeocodedLocation[];
        try {
          found = await Location.geocodeAsync(address);
        } catch (error) {
          // Offline or asked too often: stop, and the address waits for next time.
          if ((error as { code?: unknown } | null)?.code === NETWORK) return;
          // Anything else is about this address, which must not hold up the rest.
          found = [];
        }
        // Only an empty answer means "no such place", which is kept for good.
        setGeocode(address, found[0] ? { lat: found[0].latitude, lng: found[0].longitude } : null);
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      }
      if (++unshown >= SHOW_EVERY) {
        unshown = 0;
        showLocations();
      }
    }
  } finally {
    if (unshown > 0) showLocations();
  }
}

/** Starts looking up waiting addresses, unless that is already under way. */
export function locateVenues(): void {
  if (running || Platform.OS === 'web') return;
  running = true;
  work()
    // A failure here leaves the address waiting; there is nothing to tell anyone.
    .catch(() => {})
    .finally(() => {
      running = false;
    });
}
