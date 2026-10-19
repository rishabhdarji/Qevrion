// Links in an event come from outside, from a calendar or a file, and the app offers
// to open them. A link that looks like one place and goes to another is the oldest
// trick there is, so only plain web links are kept.

// Blank space and control characters, which have no place in a link and can hide what
// follows them; a backslash, which a browser may read as a slash; and the marks that
// turn text round so a link reads differently from how it opens.
const HIDDEN = /[\s\\\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/;

/** The link if it is a plain web link that is safe to offer, otherwise null. */
export function webLink(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000 || HIDDEN.test(value)) return null;
  // Where the link goes: everything between "//" and the first "/", "?" or "#".
  const place = /^https?:\/\/([^/?#]*)/i.exec(value)?.[1];
  // A name and "@" in front of the place, as in https://partiful.com@elsewhere.example,
  // makes a link look as if it goes to the name.
  if (!place || place.includes('@') || place.replace(/:\d*$/, '') === '') return null;
  return value;
}

/** Whether a link goes to Partiful itself: partiful.com, or a part of it. */
export const isPartifulLink = (url: string): boolean =>
  /^https?:\/\/([a-z0-9-]+\.)*partiful\.com(:\d+)?([/?#]|$)/i.test(url);
