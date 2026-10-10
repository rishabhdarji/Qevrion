import type { QevrionEvent } from '../types';
import { formatMonth, isSameDay } from './dates';

// Turns a set of events into the flat list Home and Archive render: labels, the hero
// and rows, in order. Pure, so it is easy to test and cheap to re-run.

export const FILTERS = ['All', 'Today', 'This week', 'Has conflicts', 'Partiful'] as const;
export type Filter = (typeof FILTERS)[number];

export type ListItem =
  | { kind: 'label'; key: string; text: string; count?: number }
  | { kind: 'hero'; key: string; event: QevrionEvent }
  | { kind: 'row'; key: string; event: QevrionEvent; divider: boolean };

const WEEK = 7 * 24 * 60 * 60 * 1000;

function matchesFilter(event: QevrionEvent, filter: Filter, now: number): boolean {
  switch (filter) {
    case 'Today':
      return isSameDay(event.startsAt, now);
    case 'This week':
      return event.startsAt - now < WEEK;
    case 'Has conflicts':
      return event.hasConflict;
    case 'Partiful':
      return event.isPartiful;
    default:
      return true;
  }
}

function matchesSearch(event: QevrionEvent, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [event.title, event.locationText, event.host].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

function monthKey(ms: number): number {
  const date = new Date(ms);
  return date.getFullYear() * 12 + date.getMonth();
}

function rows(events: QevrionEvent[]): ListItem[] {
  return events.map((event, index) => ({ kind: 'row', key: event.id, event, divider: index > 0 }));
}

/** Rows under one label per run of events that share a group. */
function grouped(
  events: QevrionEvent[],
  groupOf: (event: QevrionEvent) => number,
  labelOf: (event: QevrionEvent) => string,
): ListItem[] {
  const items: ListItem[] = [];
  let start = 0;
  for (let index = 1; index <= events.length; index++) {
    if (index < events.length && groupOf(events[index]) === groupOf(events[start])) continue;
    const group = events.slice(start, index);
    // The label is only formatted once per group; date formatting is not free.
    const text = labelOf(group[0]);
    items.push({ kind: 'label', key: `label-${text}`, text, count: group.length }, ...rows(group));
    start = index;
  }
  return items;
}

/**
 * Home: the next event as the hero, then "This week", then one group per month.
 * With a search or filter active it is a single list of matches instead.
 * An empty result means there is nothing to show.
 */
export function buildHomeItems(
  events: QevrionEvent[],
  now: number,
  query = '',
  filter: Filter = 'All',
): ListItem[] {
  const upcoming = events
    .filter((event) => event.endsAt > now)
    .sort((a, b) => a.startsAt - b.startsAt);

  if (filter !== 'All' || query.trim() !== '') {
    const matches = upcoming.filter(
      (event) => matchesFilter(event, filter, now) && matchesSearch(event, query),
    );
    if (matches.length === 0) return [];
    const text = matches.length === 1 ? '1 result' : `${matches.length} results`;
    return [{ kind: 'label', key: 'label-results', text }, ...rows(matches)];
  }

  const [next, ...later] = upcoming;
  if (!next) return [];
  const thisWeek = (event: QevrionEvent) => event.startsAt - now < WEEK;
  return [
    { kind: 'label', key: 'label-next', text: 'Next up' },
    { kind: 'hero', key: `hero-${next.id}`, event: next },
    ...grouped(
      later,
      (event) => (thisWeek(event) ? -1 : monthKey(event.startsAt)),
      (event) => (thisWeek(event) ? 'This week' : formatMonth(event.startsAt)),
    ),
  ];
}

/** Archive: events that are over, newest first, one group per month. */
export function buildArchiveItems(events: QevrionEvent[], now: number): ListItem[] {
  const past = events
    .filter((event) => event.endsAt <= now)
    .sort((a, b) => b.startsAt - a.startsAt);
  return grouped(
    past,
    (event) => monthKey(event.startsAt),
    (event) => formatMonth(event.startsAt),
  );
}
