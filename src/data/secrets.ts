import * as SecureStore from 'expo-secure-store';

// The openrouteservice key, in the iPhone's keychain rather than SQLite (SPEC 7), and
// readable only while the phone is unlocked. Kept in memory once read, so a route can
// ask for it without waiting.

const ROUTE_KEY = 'openrouteserviceKey';

let cached: string | null | undefined;

/** The saved key, or null when there is none. */
export async function getRouteKey(): Promise<string | null> {
  if (cached === undefined) {
    try {
      cached = (await SecureStore.getItemAsync(ROUTE_KEY)) || null;
    } catch {
      // Keychain unreadable: as if no key, and the next ask tries again.
      return null;
    }
  }
  return cached;
}

/** Saves the key, or with null removes it. */
export async function setRouteKey(key: string | null): Promise<void> {
  if (key) {
    await SecureStore.setItemAsync(ROUTE_KEY, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(ROUTE_KEY);
  }
  cached = key;
}
