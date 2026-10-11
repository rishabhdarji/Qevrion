import { startOfDay } from './dates';
import { parseIcs } from './ics';
import { planImport } from './importPlan';

// Times with a zone are checked as exact moments, and times without one against this
// phone's own clock, so every expectation holds in any time zone; `npm run test:zones`
// runs six. The files in __fixtures__ are invented. Each is read with both kinds of
// line ending, because Git may hand them over with either.

declare const __dirname: string;
const { readFileSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: 'utf8') => string;
}>('node:fs');

const utc = (iso: string) => Date.parse(iso);
const local = (...date: [number, number, number, number?, number?]) => new Date(...date).getTime();
/** Wide enough for everything in the fixtures. */
const autumn = { from: utc('2026-09-01T00:00:00Z'), to: utc('2026-12-31T00:00:00Z') };

function read(name: string, within = autumn) {
  const lf = readFileSync(`${__dirname}/__fixtures__/${name}.ics`, 'utf8').replace(/\r\n/g, '\n');
  const result = parseIcs(lf, within);
  expect(parseIcs(lf.replace(/\n/g, '\r\n'), within)).toEqual(result);
  return result;
}

/** A calendar written out here, for a case too small to deserve a file. */
const calendar = (...lines: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...lines, 'END:VCALENDAR', ''].join('\r\n');
const vevent = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'];
const dinner = vevent('UID:dinner@example.com', 'DTSTART:20261017T170000Z', 'SUMMARY:Dinner');

describe('times', () => {
  it('reads a zone the file defines, UTC and a time with no zone', () => {
    const { events, skipped } = read('timed');
    expect(skipped).toBe(0);
    expect(events).toEqual([
      {
        sourceId: 'zoned-1@example.com',
        title: 'Rooftop Supper Club',
        // 19:00 where clocks are three hours ahead, wherever this phone is.
        startsAt: utc('2026-10-17T16:00:00Z'),
        endsAt: utc('2026-10-17T19:00:00Z'),
        allDay: false,
        locationText: 'The Glasshouse, 14 Alder Row',
        host: 'Maya Okafor',
        url: null,
        description: '',
      },
      {
        sourceId: 'utc-1@example.com',
        title: 'Design Meetup',
        startsAt: utc('2026-10-18T17:00:00Z'),
        // From DURATION, an hour and a half.
        endsAt: utc('2026-10-18T18:30:00Z'),
        allDay: false,
        locationText: '',
        // The organiser has no name here, and the email address is never kept.
        host: '',
        url: null,
        description: '',
      },
      {
        sourceId: 'floating-1@example.com',
        title: 'Long Run and Brunch',
        // No zone at all: half past nine on this phone's clock, and no end.
        startsAt: local(2026, 9, 19, 9, 30),
        endsAt: local(2026, 9, 19, 9, 30),
        allDay: false,
        locationText: '',
        host: '',
        url: null,
        description: '',
      },
    ]);
  });

  it('works out a zone the file only names, and falls back to this phone for one it does not know', () => {
    const { events, skipped } = read('no-vtimezone');
    expect(skipped).toBe(0);
    expect(events.map(({ title, startsAt, endsAt }) => ({ title, startsAt, endsAt }))).toEqual([
      { title: 'Jazz Session', startsAt: utc('2026-10-21T10:00:00Z'), endsAt: utc('2026-10-21T12:00:00Z') },
      // An hour after New York's clocks went back.
      { title: 'Late-Night Open Mic', startsAt: utc('2026-11-01T08:00:00Z'), endsAt: utc('2026-11-01T10:00:00Z') },
      // "Eastern Standard Time" is Windows' name for a zone, not one a phone knows.
      { title: 'Gallery Night', startsAt: local(2026, 9, 22, 19), endsAt: local(2026, 9, 22, 20, 30) },
    ]);
  });

  it('gets a named zone right on both sides of a clock change', () => {
    const cases = [
      ['America/New_York', '20261101T003000', '2026-11-01T04:30:00Z'],
      ['America/New_York', '20261101T030000', '2026-11-01T08:00:00Z'],
      ['America/New_York', '20260308T013000', '2026-03-08T06:30:00Z'],
      ['America/New_York', '20260308T033000', '2026-03-08T07:30:00Z'],
      ['Europe/Berlin', '20260329T013000', '2026-03-29T00:30:00Z'],
      ['Europe/Berlin', '20260329T033000', '2026-03-29T01:30:00Z'],
      ['Australia/Lord_Howe', '20261004T013000', '2026-10-03T15:00:00Z'],
      ['Australia/Lord_Howe', '20261004T030000', '2026-10-03T16:00:00Z'],
      ['Pacific/Kiritimati', '20261017T190000', '2026-10-17T05:00:00Z'],
      ['Asia/Kathmandu', '20261017T190000', '2026-10-17T13:15:00Z'],
    ];
    const file = calendar(
      ...cases.flatMap(([zone, start], index) =>
        vevent(`UID:case-${index}@example.com`, `DTSTART;TZID=${zone}:${start}`, 'SUMMARY:Case'),
      ),
    );
    expect(parseIcs(file, autumn).events.map((event) => new Date(event.startsAt).toISOString())).toEqual(
      cases.map(([, , moment]) => new Date(moment).toISOString()),
    );
  });

  it('reads a date with no time as that day on this phone', () => {
    const { events } = read('all-day');
    expect(events).toMatchObject([
      // No end given: the one day.
      { title: 'Makers Market', allDay: true, startsAt: startOfDay(2026, 9, 31), endsAt: startOfDay(2026, 10, 1) },
      // The end in the file is already the day after the last day.
      { title: 'Harvest Festival', allDay: true, startsAt: startOfDay(2026, 10, 6), endsAt: startOfDay(2026, 10, 9) },
    ]);
  });
});

describe('text', () => {
  it('joins folded lines and undoes the escapes', () => {
    expect(read('folded').events).toMatchObject([
      {
        title: 'Board Game Social, with snacks; bring a game',
        description: 'Doors open at six.\nBring a game, a friend; or both.\n\nUpstairs, second door on the left.',
        locationText: 'Meeple Corner Café, 3 Foundry Lane',
      },
    ]);
  });

  it('reads an invitation with its link', () => {
    expect(read('partiful').events).toEqual([
      {
        sourceId: 'EXAMPLE123@example.com',
        title: "Elena's Housewarming",
        startsAt: utc('2026-10-24T02:00:00Z'),
        endsAt: utc('2026-10-24T05:00:00Z'),
        allDay: false,
        locationText: 'Flat 3, 27 Wren Street',
        host: 'Elena Marsh',
        url: 'https://partiful.com/e/EXAMPLE123',
        description: 'You are invited! See who is coming and reply here:\nhttps://partiful.com/e/EXAMPLE123',
      },
    ]);
  });
});

describe('repeating events', () => {
  const key = (start: string) => `weekly-1@example.com|${start}`;

  it('lays out each occurrence, leaving out the excluded date and moving the changed one', () => {
    const { events, skipped } = read('weekly');
    expect(skipped).toBe(0);
    expect(events.map(({ sourceId, title, startsAt, endsAt }) => ({ sourceId, title, startsAt, endsAt }))).toEqual([
      {
        sourceId: key('2026-10-05T18:00:00.000Z'),
        title: 'Pottery Class',
        startsAt: utc('2026-10-05T18:00:00Z'),
        endsAt: utc('2026-10-05T19:30:00Z'),
      },
      {
        sourceId: key('2026-10-12T18:00:00.000Z'),
        title: 'Pottery Class',
        startsAt: utc('2026-10-12T18:00:00Z'),
        endsAt: utc('2026-10-12T19:30:00Z'),
      },
      // The 19th is excluded. The 26th was moved a day, and is still keyed by the 26th.
      {
        sourceId: key('2026-10-26T18:00:00.000Z'),
        title: 'Pottery Class (moved to Tuesday)',
        startsAt: utc('2026-10-27T19:00:00Z'),
        endsAt: utc('2026-10-27T21:00:00Z'),
      },
      {
        sourceId: key('2026-11-02T18:00:00.000Z'),
        title: 'Pottery Class',
        startsAt: utc('2026-11-02T18:00:00Z'),
        endsAt: utc('2026-11-02T19:30:00Z'),
      },
      {
        sourceId: key('2026-11-09T18:00:00.000Z'),
        title: 'Pottery Class',
        startsAt: utc('2026-11-09T18:00:00Z'),
        endsAt: utc('2026-11-09T19:30:00Z'),
      },
    ]);
    expect(events[2].locationText).toBe('Harbour Print Studio');
  });

  it('takes only the occurrences inside the dates asked for', () => {
    const within = { from: utc('2026-10-10T00:00:00Z'), to: utc('2026-11-05T00:00:00Z') };
    expect(read('weekly', within).events.map((event) => event.sourceId)).toEqual([
      key('2026-10-12T18:00:00.000Z'),
      key('2026-10-26T18:00:00.000Z'),
      key('2026-11-02T18:00:00.000Z'),
    ]);
    // A one-off event is read whatever its date.
    const longAgo = { from: utc('2020-01-01T00:00:00Z'), to: utc('2020-02-01T00:00:00Z') };
    expect(read('weekly', longAgo).events).toEqual([]);
    expect(read('timed', longAgo).events).toHaveLength(3);
  });

  it('keeps the time on the clock the same across a clock change', () => {
    const file = calendar(
      ...vevent(
        'UID:nightly@example.com',
        'DTSTART;TZID=America/New_York:20261030T190000',
        'DURATION:PT1H',
        'RRULE:FREQ=DAILY;COUNT=4',
        'SUMMARY:Night Market',
      ),
    );
    expect(parseIcs(file, autumn).events.map((event) => new Date(event.startsAt).toISOString())).toEqual([
      '2026-10-30T23:00:00.000Z',
      '2026-10-31T23:00:00.000Z',
      // The clocks went back that morning: seven in the evening is an hour later in UTC.
      '2026-11-02T00:00:00.000Z',
      '2026-11-03T00:00:00.000Z',
    ]);
  });

  it('repeats whole days as whole days', () => {
    const file = calendar(
      ...vevent('UID:market@example.com', 'DTSTART;VALUE=DATE:20261024', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Market'),
    );
    expect(parseIcs(file, autumn).events).toMatchObject([
      { allDay: true, startsAt: startOfDay(2026, 9, 24), endsAt: startOfDay(2026, 9, 25) },
      { allDay: true, startsAt: startOfDay(2026, 9, 31), endsAt: startOfDay(2026, 10, 1) },
      { allDay: true, startsAt: startOfDay(2026, 10, 7), endsAt: startOfDay(2026, 10, 8) },
    ]);
  });

  it('leaves out an occurrence that was cancelled, and keeps a changed one whose event is missing', () => {
    const file = calendar(
      ...vevent('UID:class@example.com', 'DTSTART:20261005T180000Z', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Class'),
      ...vevent(
        'UID:class@example.com',
        'RECURRENCE-ID:20261012T180000Z',
        'DTSTART:20261012T180000Z',
        'STATUS:CANCELLED',
        'SUMMARY:Class',
      ),
      ...vevent(
        'UID:elsewhere@example.com',
        'RECURRENCE-ID:20261014T180000Z',
        'DTSTART:20261015T180000Z',
        'SUMMARY:One night of a series',
      ),
    );
    const { events, skipped } = parseIcs(file, autumn);
    expect(skipped).toBe(1);
    expect(events.map((event) => event.sourceId)).toEqual([
      'class@example.com|2026-10-05T18:00:00.000Z',
      'class@example.com|2026-10-19T18:00:00.000Z',
      'elsewhere@example.com|2026-10-14T18:00:00.000Z',
    ]);
  });

  it('takes at most 500 occurrences from one event', () => {
    const file = calendar(
      ...vevent('UID:daily@example.com', 'DTSTART:20260901T090000Z', 'RRULE:FREQ=DAILY', 'SUMMARY:Stand-up'),
      ...dinner,
    );
    const { events, skipped } = parseIcs(file, { from: autumn.from, to: utc('2030-01-01T00:00:00Z') });
    expect(events).toHaveLength(501);
    expect(skipped).toBe(1);
    expect(events[499].sourceId).toBe('daily@example.com|2028-01-13T09:00:00.000Z');
    expect(events[500].title).toBe('Dinner');
  });

  it('reaches the dates asked for from a start years before them', () => {
    const file = calendar(
      ...vevent('UID:old@example.com', 'DTSTART:20100104T090000Z', 'RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR', 'SUMMARY:Work'),
    );
    const week = { from: utc('2026-10-12T00:00:00Z'), to: utc('2026-10-18T23:59:59Z') };
    expect(parseIcs(file, week).events.map((event) => new Date(event.startsAt).toISOString().slice(0, 10))).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ]);
  });

  it('skips a rule that would never end its search, without trying it', () => {
    const file = calendar(
      // There is no 30th of February, and "every second" is no invitation.
      ...vevent('UID:never@example.com', 'DTSTART:20261001T090000Z', 'RRULE:FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30', 'SUMMARY:Never'),
      ...vevent('UID:second-monday@example.com', 'DTSTART:20261001T090000Z', 'RRULE:FREQ=DAILY;BYDAY=2MO', 'SUMMARY:Never'),
      ...vevent('UID:ticking@example.com', 'DTSTART:20261001T090000Z', 'RRULE:FREQ=SECONDLY', 'SUMMARY:Tick'),
      ...dinner,
    );
    const { events, skipped } = parseIcs(file, autumn);
    expect(skipped).toBe(3);
    expect(events.map((event) => event.title)).toEqual(['Dinner']);
  });

  it('gives up on repeats when they have taken too long, and reads the rest', () => {
    const file = calendar(
      ...vevent('UID:daily@example.com', 'DTSTART:20261001T090000Z', 'RRULE:FREQ=DAILY', 'SUMMARY:Stand-up'),
      ...vevent('UID:weekly@example.com', 'DTSTART:20261001T090000Z', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Review'),
      ...dinner,
    );
    // A clock that jumps a second every time it is looked at.
    let now = 0;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
    try {
      const { events, skipped } = parseIcs(file, autumn);
      expect(events.map((event) => event.title)).toEqual(['Stand-up', 'Stand-up', 'Dinner']);
      expect(skipped).toBe(2);
    } finally {
      clock.mockRestore();
    }
  });
});

describe('what is left out', () => {
  it('skips a cancelled event and says so', () => {
    const { events, skipped } = read('cancelled');
    expect(events.map((event) => event.title)).toEqual(['Candlelit Jazz Session']);
    expect(skipped).toBe(1);
  });

  it('skips an event it cannot read, and reads the others', () => {
    const file = calendar(
      ...vevent('UID:no-start@example.com', 'SUMMARY:When?'),
      ...vevent('UID:bad-start@example.com', 'DTSTART:garbage', 'SUMMARY:No such time'),
      ...dinner,
    );
    const { events, skipped } = parseIcs(file, autumn);
    expect(events.map((event) => event.title)).toEqual(['Dinner']);
    expect(skipped).toBe(2);
  });

  it('stops at 5,000 events and counts the rest', () => {
    const many = Array.from({ length: 5010 }, (_, index) =>
      vevent(`UID:many-${index}@example.com`, 'DTSTART:20261017T170000Z', `SUMMARY:Event ${index}`),
    ).flat();
    const { events, skipped } = parseIcs(calendar(...many), autumn);
    expect(events).toHaveLength(5000);
    expect(skipped).toBe(10);
  });
});

describe('files', () => {
  it('refuses a file that is not a calendar, in words a screen can show', () => {
    expect(() => read('not-a-calendar')).toThrow('This file is not a calendar.');
    expect(() => parseIcs('', autumn)).toThrow('This file is not a calendar.');
    expect(() => parseIcs(vevent('SUMMARY:No calendar around it').join('\r\n'), autumn)).toThrow(
      'This file is not a calendar.',
    );
  });

  it('refuses a calendar that is cut short or too big', () => {
    expect(() => parseIcs('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Cut off', autumn)).toThrow(
      'This calendar file is damaged and could not be read.',
    );
    expect(() => parseIcs(`BEGIN:VCALENDAR\r\n${'X'.repeat(5_000_000)}`, autumn)).toThrow(
      'This file is too big to import.',
    );
  });

  it('reads past an invisible mark and blank lines at the top, and more than one calendar', () => {
    const file = `﻿\r\n\n${calendar(...dinner)}${calendar(...vevent('UID:lunch@example.com', 'DTSTART:20261018T120000Z', 'SUMMARY:Lunch'))}`;
    expect(parseIcs(file, autumn).events.map((event) => event.title)).toEqual(['Dinner', 'Lunch']);
  });

  it('gives an event with no UID a key made of its title and start', () => {
    const file = calendar(...vevent('DTSTART:20261017T170000Z', 'SUMMARY:Dinner'));
    expect(parseIcs(file, autumn).events[0].sourceId).toBe('Dinner|2026-10-17T17:00:00.000Z');
  });

  it('gives the same keys every time, so importing a file twice adds nothing', () => {
    const everything = () =>
      [
        ...['timed', 'all-day', 'folded', 'no-vtimezone', 'weekly', 'partiful', 'cancelled'].flatMap(
          (name) => read(name).events,
        ),
        // No UID, and a day given the same date as its start and its end.
        ...parseIcs(
          calendar(
            ...vevent('DTSTART:20261017T170000Z', 'DTEND:20261017T190000Z', 'SUMMARY:Dinner'),
            ...vevent('UID:same-day@example.com', 'DTSTART;VALUE=DATE:20261031', 'DTEND;VALUE=DATE:20261031', 'SUMMARY:Fair'),
          ),
          autumn,
        ).events,
      ];
    const first = planImport([], everything(), { source: 'ics' });
    expect(first.result).toEqual({ added: 18, updated: 0, unchanged: 0, skipped: 0 });
    // The rules stretch the fair to the whole of its day.
    expect(first.inserts.at(-1)).toMatchObject({ startsAt: startOfDay(2026, 9, 31), endsAt: startOfDay(2026, 10, 1) });

    const stored = first.inserts.map((event, index) => ({
      ...event,
      id: String(index),
      removedFromSource: false,
      deleted: false,
    }));
    expect(planImport(stored, everything(), { source: 'ics' }).result).toEqual({
      added: 0,
      updated: 0,
      unchanged: 18,
      skipped: 0,
    });
  });
});
