import {
  allDayToLocal,
  allDayToUtc,
  dayStart,
  formatDay,
  formatEventSpan,
  formatEventTime,
  formatTime,
  startOfDay,
} from './dates';

// These hold in every time zone. `npm run test:zones` runs them in six, including ones
// where the clocks change at midnight or by half an hour.

const HOUR = 3_600_000;
/** Every day of 2026 as [month, day], so each zone's clock-change days are included. */
const DAYS_OF_2026 = Array.from({ length: 365 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 0, 1 + index));
  return [date.getUTCMonth(), date.getUTCDate()] as const;
});

const localDate = (ms: number) => {
  const date = new Date(ms);
  return [date.getFullYear(), date.getMonth(), date.getDate()];
};

describe('startOfDay', () => {
  it('is the first moment of that day here, every day of the year', () => {
    for (const [month, day] of DAYS_OF_2026) {
      const start = startOfDay(2026, month, day);
      expect(localDate(start)).toEqual([2026, month, day]);
      expect(localDate(start - 1)).not.toEqual([2026, month, day]);
    }
  });

  it('carries a day past the end of the month into the next one', () => {
    expect(startOfDay(2026, 9, 32)).toBe(startOfDay(2026, 10, 1));
    expect(startOfDay(2026, 11, 32)).toBe(startOfDay(2027, 0, 1));
  });
});

describe('dayStart', () => {
  it('finds the start of the day from any moment in it', () => {
    for (const [month, day] of DAYS_OF_2026) {
      const start = startOfDay(2026, month, day);
      expect(dayStart(start)).toBe(start);
      expect(dayStart(start + 13 * HOUR)).toBe(start);
      expect(dayStart(startOfDay(2026, month, day + 1) - 1)).toBe(start);
    }
  });

  it('steps by calendar days, however long the day is', () => {
    for (const [month, day] of DAYS_OF_2026) {
      const noon = new Date(2026, month, day, 12).getTime();
      expect(dayStart(noon, 1)).toBe(startOfDay(2026, month, day + 1));
      expect(dayStart(noon, -1)).toBe(startOfDay(2026, month, day - 1));
    }
  });
});

describe('all-day dates', () => {
  it('reads a stored date as the same calendar date here', () => {
    for (const [month, day] of DAYS_OF_2026) {
      const local = allDayToLocal(Date.UTC(2026, month, day));
      expect(local).toBe(startOfDay(2026, month, day));
      expect(localDate(local)).toEqual([2026, month, day]);
    }
  });

  it('stores any moment of a day as that date at midnight UTC', () => {
    for (const [month, day] of DAYS_OF_2026) {
      const stored = Date.UTC(2026, month, day);
      const start = startOfDay(2026, month, day);
      expect(allDayToUtc(start)).toBe(stored);
      expect(allDayToUtc(start + 13 * HOUR)).toBe(stored);
      expect(allDayToUtc(startOfDay(2026, month, day + 1) - 1)).toBe(stored);
    }
  });

  it('keeps the first of a month in that month', () => {
    // Behind UTC, midnight UTC on the 1st is still the last day of the month before.
    expect(new Date(allDayToLocal(Date.UTC(2026, 10, 1))).getMonth()).toBe(10);
    // Ahead of UTC, the last evening of a month is already the next month in UTC.
    expect(new Date(allDayToUtc(new Date(2026, 9, 31, 23, 30).getTime())).getUTCMonth()).toBe(9);
  });
});

describe('formatEventSpan', () => {
  const evening = new Date(2026, 9, 17, 19).getTime();
  const span = (startsAt: number, endsAt: number, allDay = false) =>
    formatEventSpan({ startsAt, endsAt, allDay });

  it('gives the day and both times for an ordinary event', () => {
    expect(span(evening, evening + 3 * HOUR)).toEqual({
      days: formatDay(evening),
      times: `${formatTime(evening)} to ${formatTime(evening + 3 * HOUR)}`,
    });
  });

  it('leaves the day off an end that is past midnight but under a day away', () => {
    const late = evening + 7 * HOUR;
    expect(span(evening, late).times).toBe(`${formatTime(evening)} to ${formatTime(late)}`);
  });

  it('names the day an event ends on once it runs a day or more', () => {
    const later = evening + 50 * HOUR;
    expect(span(evening, later).times).toBe(
      `${formatTime(evening)} to ${formatDay(later)} · ${formatTime(later)}`,
    );
  });

  it('says All day, with the last day rather than the day after it', () => {
    const first = startOfDay(2026, 9, 17);
    expect(span(first, startOfDay(2026, 9, 18), true)).toEqual({
      days: formatDay(first),
      times: 'All day',
    });
    expect(span(first, startOfDay(2026, 9, 20), true).days).toBe(
      `${formatDay(first)} to ${formatDay(startOfDay(2026, 9, 19))}`,
    );
  });
});

describe('formatEventTime', () => {
  it('says All day instead of a midnight time', () => {
    expect(formatEventTime({ startsAt: startOfDay(2026, 9, 17), allDay: true })).toBe('All day');
    expect(formatEventTime({ startsAt: startOfDay(2026, 9, 17), allDay: false })).not.toBe('All day');
  });
});
