import type { QevrionEvent } from '../types';
import { formatMonth, startOfDay } from './dates';
import {
  buildArchiveItems,
  buildHomeItems,
  nextBoundary,
  selectNextEvent,
  type ListItem,
} from './homeItems';

// Written with local clock times, so every expectation holds in any time zone.
// `npm run test:zones` runs them in six.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
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
    allDay: false,
    locationText: 'Somewhere',
    host: 'Someone',
    description: '',
    url: null,
    isPartiful: false,
    notes: '',
    keyDetails: [],
    photo: null,
    isSample: true,
    cover: ['#000000', '#000000'],
    hasConflict: false,
    ...extra,
  };
}

/** An all-day event as the app holds it: from the start of its first day to the end of its last. */
function allDay(id: string, year: number, month: number, day: number, days = 1): QevrionEvent {
  return event(id, startOfDay(year, month, day), {
    allDay: true,
    endsAt: startOfDay(year, month, day + days),
  });
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
const home = (events: QevrionEvent[], at = now, ...rest: [string?, Parameters<typeof buildHomeItems>[3]?]) =>
  buildHomeItems(events, at, ...rest).map(describeItem);

describe('buildHomeItems', () => {
  it('puts the soonest upcoming event in the hero, then this week, then months', () => {
    expect(home(all)).toEqual([
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

  it('moves the hero on the moment an event starts, and keeps that event under Happening now', () => {
    const justBefore = soon.startsAt - 1;
    expect(home(all, justBefore)[1]).toBe('hero:soon');
    // At the start itself the countdown has reached zero, so the hero has moved on.
    expect(home(all, soon.startsAt).slice(0, 4)).toEqual([
      'label:Next up',
      'hero:week',
      'label:Happening now',
      'row:soon',
    ]);
  });

  it('drops an event from Home once the clock passes its end', () => {
    expect(home(all, soon.endsAt - 1)).toContain('row:soon');
    expect(home(all, soon.endsAt)).not.toContain('row:soon');
  });

  it('still shows what is happening now when nothing else is coming', () => {
    const running = event('running', now - HOUR);
    expect(home([running, past])).toEqual(['label:Happening now', 'row:running']);
  });

  it('lists matches without a hero when a filter or search is active', () => {
    expect(home(all, now, '', 'Partiful')).toEqual(['label:1 result', 'row:week']);
    expect(home(all, now, '', 'Has conflicts')).toEqual(['label:1 result', 'row:same-month']);
    expect(home(all, now, '  okafor ', 'All')).toEqual(['label:1 result', 'row:soon']);
    expect(home(all, now, '', 'This week')).toEqual(['label:2 results', 'row:soon', 'row:week']);
  });

  it('counts an event as today if it is running or starts before midnight', () => {
    const running = event('running', now - HOUR);
    const tonight = event('tonight', new Date(2026, 9, 10, 23, 30).getTime());
    const afterMidnight = event('after-midnight', new Date(2026, 9, 11, 0, 30).getTime());
    expect(home([afterMidnight, tonight, running], now, '', 'Today')).toEqual([
      'label:2 results',
      'row:running',
      'row:tonight',
    ]);
  });

  it('returns nothing when there is nothing to show', () => {
    expect(home(all, now, 'no such event')).toEqual([]);
    expect(home(all, now, '', 'Today')).toEqual([]);
    expect(home([past])).toEqual([]);
  });

  it('groups by the month on the phone, either side of midnight on the last day', () => {
    // In UTC these two fall in the same month for zones well ahead of or behind it.
    const lastNight = event('last-night', new Date(2026, 10, 30, 23, 30).getTime());
    const firstMorning = event('first-morning', new Date(2026, 11, 1, 0, 30).getTime());
    const hero = event('hero', now + DAY);
    expect(home([firstMorning, lastNight, hero]).slice(2)).toEqual([
      `label:${formatMonth(new Date(2026, 10, 15).getTime())}`,
      'row:last-night',
      `label:${formatMonth(new Date(2026, 11, 15).getTime())}`,
      'row:first-morning',
    ]);
  });
});

describe('all-day events on Home', () => {
  it('keeps an all-day event on the first of a month in that month', () => {
    const hero = event('hero', now + DAY);
    const first = allDay('first', 2026, 11, 1);
    expect(home([first, hero]).slice(2)).toEqual([
      `label:${formatMonth(new Date(2026, 11, 15).getTime())}`,
      'row:first',
    ]);
  });

  it('is the next event until its day begins, then is happening now all day', () => {
    const tomorrow = allDay('tomorrow', 2026, 9, 11);
    const later = event('later', now + 5 * DAY);
    expect(home([later, tomorrow])[1]).toBe('hero:tomorrow');

    const midday = new Date(2026, 9, 11, 12).getTime();
    expect(home([later, tomorrow], midday)).toEqual([
      'label:Next up',
      'hero:later',
      'label:Happening now',
      'row:tomorrow',
    ]);
    // Gone the moment the next day begins, not a day early or late.
    expect(home([later, tomorrow], startOfDay(2026, 9, 12) - 1)).toContain('row:tomorrow');
    expect(home([later, tomorrow], startOfDay(2026, 9, 12))).not.toContain('row:tomorrow');
  });

  it('runs a three-day event through its last day', () => {
    const festival = allDay('festival', 2026, 9, 9, 3);
    expect(home([festival])).toEqual(['label:Happening now', 'row:festival']);
    expect(home([festival], startOfDay(2026, 9, 12))).toEqual([]);
    expect(buildArchiveItems([festival], startOfDay(2026, 9, 12)).map(describeItem)).toContain(
      'row:festival',
    );
  });

  it('sorts an all-day event ahead of a timed one on the same day', () => {
    const dinner = event('dinner', new Date(2026, 9, 12, 19).getTime());
    const birthday = allDay('birthday', 2026, 9, 12);
    const hero = event('hero', now + HOUR);
    expect(home([dinner, birthday, hero]).slice(2)).toEqual([
      'label:This week',
      'row:birthday',
      'row:dinner',
    ]);
  });
});

describe('selectNextEvent', () => {
  const sorted = [past, soon, week];

  it('is the first event that has not started', () => {
    expect(selectNextEvent(sorted, now)).toBe(soon);
    expect(selectNextEvent(sorted, soon.startsAt - 1)).toBe(soon);
  });

  it('moves on at the start time, not at the end', () => {
    expect(selectNextEvent(sorted, soon.startsAt)).toBe(week);
  });

  it('is nothing when every event has started', () => {
    expect(selectNextEvent(sorted, week.startsAt)).toBeUndefined();
    expect(selectNextEvent([], now)).toBeUndefined();
  });
});

describe('nextBoundary', () => {
  it('is the next start or end after now, whichever comes first', () => {
    expect(nextBoundary(all, now)).toBe(soon.startsAt);
    expect(nextBoundary(all, soon.startsAt)).toBe(soon.endsAt);
    expect(nextBoundary(all, soon.endsAt)).toBe(week.startsAt);
  });

  it('is never now itself, and is Infinity when nothing is left', () => {
    expect(nextBoundary([soon], soon.endsAt)).toBe(Infinity);
    expect(nextBoundary([], now)).toBe(Infinity);
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

  it('takes an event the moment it ends', () => {
    expect(buildArchiveItems([soon], soon.endsAt - 1)).toEqual([]);
    expect(buildArchiveItems([soon], soon.endsAt).map(describeItem)).toContain('row:soon');
  });
});
