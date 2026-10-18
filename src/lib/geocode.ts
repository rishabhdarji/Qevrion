import * as Location from 'expo-location';
import { AppState, Platform } from 'react-native';

import { nextPendingAddress, setGeocode } from '../data/events';

// Finds where each event's address is on the map, with the iPhone's own geocoder: no
// key, and no location permission, but it needs the network and Apple limits how fast
// it may be asked, with no number published. So one address at a time, a pause
// between them, and only while the app is on screen. What is found is kept in the
// database, and no address is ever asked for twice (src/data/db.ts).
//
// ponytail: each answer reloads the whole event list once, fine for a few hundred
// events; batch the answers if a first import of thousands ever feels slow.

const PAUSE_MS = 1500;

let running = false;

async function work(): Promise<void> {
  while (AppState.currentState === 'active') {
    const address = nextPendingAddress();
    if (!address) return;
    let found: Location.LocationGeocodedLocation[];
    try {
      found = await Location.geocodeAsync(address);
    } catch {
      // Offline and rate-limited look the same. Either way the address stays waiting
      // for the next time the app opens.
      return;
    }
    // Only an empty answer means "no such place", which is kept for good.
    setGeocode(address, found[0] ? { lat: found[0].latitude, lng: found[0].longitude } : null);
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
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
