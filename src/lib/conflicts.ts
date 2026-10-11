type Span = { id: string; startsAt: number; endsAt: number; allDay: boolean };

/**
 * The ids of events whose times overlap another event's. All-day events never count:
 * a birthday would otherwise clash with everything that day.
 */
export function findConflicts(events: readonly Span[]): Set<string> {
  const timed = events.filter((event) => !event.allDay).sort((a, b) => a.startsAt - b.startsAt);
  const ids = new Set<string>();
  // One pass: `longest` is the event seen so far that ends last. Anything starting
  // before it ends overlaps it.
  let longest = timed[0];
  for (const event of timed.slice(1)) {
    if (event.startsAt < longest.endsAt) ids.add(event.id).add(longest.id);
    if (event.endsAt > longest.endsAt) longest = event;
  }
  return ids;
}
