import type { QevrionEvent } from '../types';
import { formatMonth } from './dates';
import { buildArchiveItems, buildHomeItems, type ListItem } from './homeItems';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Noon on the 10th, local time, so "this week" and month groups are predictable.
const now = new Date(2026, 9, 10, 12).getTime();

function event(id: string, startsAt: number, extra: Partial<QevrionEvent> = {}): QevrionEvent {
  return {
    id,
    source: 'manual',
    title: `Event ${id}`,
    startsAt,
    endsAt: startsAt + 2 * HOUR,
    locationText: 'Somewhere',
    host: 'Someone',
    description: '',
    url: null,
    isPartiful: false,
    keyDetails: [],
    isSample: true,
    cover: ['#000000', '#000000'],
    hasConflict: false,
    ...extra,
  };
}

const past = event('past', now - 3 * DAY);
const older = event('older', now - 40 * DAY);
const soon = event('soon', now + 2 * DAY, { host: 'Maya Okafor' });
const week = event('week', now + 4 * DAY, { isPartiful: true });
const month = event('month', now + 30 * DAY);
const sameMonth = event('same-month', now + 31 * DAY, { hasConflict: true });
// Deliberately out of order: the builder must sort.
const all = [month, past, sameMonth, soon, older, week];

const describeItem = (item: ListItem) =>
  item.kind === 'label' ? `label:${item.text}` : `${item.kind}:${item.event.id}`;

describe('buildHomeItems', () => {
  it('puts the soonest upcoming event in the hero, then this week, then months', () => {
    expect(buildHomeItems(all, now).map(describeItem)).toEqual([
      'label:Next up',
      'hero:soon',
      'label:This week',
      'row:week',
      `label:${formatMonth(month.startsAt)}`,
      'row:month',
      'row:same-month',
    ]);
  });

  it('counts each group and draws dividers between rows, not above the first', () => {
    const items = buildHomeItems(all, now);
    const label = items.find((item) => item.kind === 'label' && item.text === formatMonth(month.startsAt));
    expect(label).toMatchObject({ count: 2 });
    const rows = items.filter((item) => item.kind === 'row');
    expect(rows.map((row) => row.kind === 'row' && row.divider)).toEqual([false, false, true]);
  });

  it('keeps an event that has started but not ended as the hero', () => {
    const running = event('running', now - HOUR);
    expect(buildHomeItems([running, soon], now).map(describeItem).slice(0, 2)).toEqual([
      'label:Next up',
      'hero:running',
    ]);
  });

  it('moves on to the next event once the clock passes the end', () => {
    const later = soon.endsAt + 1;
    expect(buildHomeItems(all, later).map(describeItem)[1]).toBe('hero:week');
  });

  it('lists matches without a hero when a filter or search is active', () => {
    expect(buildHomeItems(all, now, '', 'Partiful').map(describeItem)).toEqual([
      'label:1 result',
      'row:week',
    ]);
    expect(buildHomeItems(all, now, '', 'Has conflicts').map(describeItem)).toEqual([
      'label:1 result',
      'row:same-month',
    ]);
    expect(buildHomeItems(all, now, '  okafor ', 'All').map(describeItem)).toEqual([
      'label:1 result',
      'row:soon',
    ]);
    expect(buildHomeItems(all, now, '', 'This week').map(describeItem)).toEqual([
      'label:2 results',
      'row:soon',
      'row:week',
    ]);
  });

  it('returns nothing when there is nothing to show', () => {
    expect(buildHomeItems(all, now, 'no such event')).toEqual([]);
    expect(buildHomeItems(all, now, '', 'Today')).toEqual([]);
    expect(buildHomeItems([past], now)).toEqual([]);
  });
});

describe('buildArchiveItems', () => {
  it('lists finished events newest first, grouped by month', () => {
    expect(buildArchiveItems(all, now).map(describeItem)).toEqual([
      `label:${formatMonth(past.startsAt)}`,
      'row:past',
      `label:${formatMonth(older.startsAt)}`,
      'row:older',
    ]);
  });
});
