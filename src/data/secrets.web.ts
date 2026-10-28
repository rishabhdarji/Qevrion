// The desktop preview's stand-in for src/data/secrets.ts: there is no keychain in a
// browser, so the key lives in memory and is gone when the page reloads.

let key: string | null = null;

export const getRouteKey = async (): Promise<string | null> => key;

export async function setRouteKey(next: string | null): Promise<void> {
  key = next;
}
