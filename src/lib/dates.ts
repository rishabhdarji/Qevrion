// Display helpers. Times are stored in UTC and shown in the device's own time zone
// and language, so no locale or zone is passed.

/** "Tue, Oct 13" */
export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "6:30 PM" */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Tue, Oct 13 · 6:30 PM" */
export function formatWhen(ms: number): string {
  return `${formatDay(ms)} · ${formatTime(ms)}`;
}

/** "November 2026" */
export function formatMonth(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function isSameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
