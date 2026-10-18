import { startOfDay } from './dates';
import { parseIcs } from './ics';
import { planImport } from './importPlan';

// Times with a zone are checked as exact moments, and times without one against this
// phone's own clock, so every expectation holds in any time zone; `npm run test:zones`
// runs six. The files in __fixtures__ are invented. Each is read with both kinds of
// line ending, because Git may hand them over with either.
//
// Some of the calendars written out below were made to freeze the reader. Nothing here
// measures how long anything takes: a reader that fell for one of them would simply
// never finish its test.

declare const __dirname: string;
const { readFileSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: 'utf8') => string;
}>('node:fs');

const utc = (iso: string) => Date.parse(iso);
const local = (...date: [number, number, number, number?, number?]) => new Date(...date).getTime();

function read(name: string) {
  const lf = readFileSync(`${__dirname}/__fixtures__/${name}.ics`, 'utf8').replace(/\r\n/g, '\n');
  const result = parseIcs(lf);
  expect(parseIcs(lf.replace(/\n/g, '\r\n'))).toEqual(result);
  return result;
}

/** A calendar written out here, for a case too small to deserve a file. */
const calendar = (...lines: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...lines, 'END:VCALENDAR', ''].join('\r\n');
const vevent = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'];
const dinner = vevent('UID:dinner@example.com', 'DTSTART:20261017T170000Z', 'SUMMARY:Dinner');

/** A zone as a file defines it: a name, and one part for each way its clocks change. */
const vtimezone = (tzid: string, ...parts: string[][]) => [
  'BEGIN:VTIMEZONE',
  `TZID:${tzid}`,
  ...parts.flat(),
  'END:VTIMEZONE',
];
const part = (kind: string, start: string, from: string, to: string, rule?: string) => [
  `BEGIN:${kind}`,
  `DTSTART:${start}`,
  `TZOFFSETFROM:${from}`,
  `TZOFFSETTO:${to}`,
  ...(rule ? [`RRULE:${rule}`] : []),
  `END:${kind}`,
];
/** New York's clocks under a name no phone knows, the way Outlook writes a zone. */
const eastern = (tzid: string, since = 1601) =>
  vtimezone(
    tzid,
    part('DAYLIGHT', `${since}0311T020000`, '-0500', '-0400', 'FREQ=YEARLY;BYMONTH=3;BYDAY=2SU'),
    part('STANDARD', `${since}1104T020000`, '-0400', '-0500', 'FREQ=YEARLY;BYMONTH=11;BYDAY=1SU'),
  );
/** An event at seven in the evening on 17 October 2026, on the clocks of the zone named. */
const at7 = (tzid: string, date = '20261017') =>
  vevent(`UID:${tzid}-${date}@example.com`, `DTSTART;TZID=${tzid}:${date}T190000`, 'SUMMARY:Seven');
const starts = (file: string) => parseIcs(file).events.map((event) => new Date(event.startsAt).toISOString());
const sevenHere = new Date(local(2026, 9, 17, 19)).toISOString();

describe('times', () => {
  it('reads a zone the file defines, UTC and a time with no zone', () => {
    const { events, skipped, repeating } = read('timed');
    expect([skipped, repeating]).toEqual([0, 0]);
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
    expect(starts(file)).toEqual(cases.map(([, , moment]) => new Date(moment).toISOString()));
  });

  it('trusts the phone over the file for a zone both of them know', () => {
    // The file says Berlin is on New York's clocks. The phone knows better.
    const file = calendar(...eastern('Europe/Berlin'), ...at7('Europe/Berlin'));
    expect(starts(file)).toEqual(['2026-10-17T17:00:00.000Z']);
  });

  it('uses the file for a zone only the file knows, when its rules are ordinary clock changes', () => {
    const zone = 'Eastern Standard Time';
    const file = calendar(
      ...eastern(zone),
      ...at7(zone),
      ...at7(zone, '20261215'),
      ...vevent(
        'UID:long@example.com',
        `DTSTART;TZID=${zone}:20260704T120000`,
        `DTEND;TZID=${zone}:20261225T120000`,
        'SUMMARY:Summer to winter',
      ),
      // Found among other definitions, by its own name.
      ...vtimezone('Example/Fixed', part('STANDARD', '19700101T000000', '+0545', '+0545')),
      ...at7('Example/Fixed'),
    );
    const { events } = parseIcs(file);
    expect(events.map((event) => new Date(event.startsAt).toISOString())).toEqual([
      // Summer time, four hours behind; then winter, five.
      '2026-10-17T23:00:00.000Z',
      '2026-12-16T00:00:00.000Z',
      '2026-07-04T16:00:00.000Z',
      '2026-10-17T13:15:00.000Z',
    ]);
    expect(new Date(events[2].endsAt).toISOString()).toBe('2026-12-25T17:00:00.000Z');
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

  it('counts a length given in days as whole days', () => {
    // Across the night New York's clocks go back, which makes that day 25 hours long.
    const file = calendar(
      ...vevent('UID:weekend@example.com', 'DTSTART;VALUE=DATE:20261031', 'DURATION:P2D', 'SUMMARY:Weekend'),
    );
    expect(parseIcs(file).events).toMatchObject([
      { allDay: true, startsAt: startOfDay(2026, 9, 31), endsAt: startOfDay(2026, 10, 2) },
    ]);
  });
});

describe('zones written to freeze the reader', () => {
  // Each of these rules, left to ical.js, is walked for ever or near enough: a week of
  // days that is never a Monday, a 30th of February, and clocks that change by the
  // minute, by the second, and by the hour since 1601.
  it.each([
    ['FREQ=DAILY;INTERVAL=7;BYDAY=MO', '19700101T000000'],
    ['FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30', '19700101T000000'],
    ['FREQ=MINUTELY', '19700101T000000'],
    ['FREQ=SECONDLY', '19700101T000000'],
    ['FREQ=HOURLY', '16010101T000000'],
    // A yearly rule, but not the plain kind.
    ['FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30', '19700101T000000'],
    ['FREQ=YEARLY;INTERVAL=2;BYMONTH=3;BYDAY=2SU', '19700101T000000'],
    ['FREQ=YEARLY;BYMONTH=3,4;BYDAY=2SU', '19700101T000000'],
    ['FREQ=YEARLY;BYMONTH=3;BYDAY=2SU;BYSETPOS=1', '19700101T000000'],
    // Every Sunday in March, a 53rd Sunday, a year with no month, and a rule from 1000.
    ['FREQ=YEARLY;BYMONTH=3;BYDAY=SU', '19700101T000000'],
    ['FREQ=YEARLY;BYMONTH=3;BYDAY=53SU', '19700101T000000'],
    ['FREQ=YEARLY;BYDAY=2SU', '19700101T000000'],
    ['FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', '10000101T000000'],
  ])('reads the time on this phone when the zone has the rule %s', (rule, since) => {
    const file = calendar(
      ...vtimezone('Hostile Zone', part('STANDARD', since, '+0100', '+0100', rule)),
      ...at7('Hostile Zone'),
      ...dinner,
    );
    expect(parseIcs(file)).toMatchObject({ skipped: 0, repeating: 0 });
    expect(starts(file)).toEqual([sevenHere, '2026-10-17T17:00:00.000Z']);
  });

  it('never looks at such a zone when the time does not need it', () => {
    const hostile = vtimezone('Europe/Berlin', part('STANDARD', '16010101T000000', '+0100', '+0100', 'FREQ=SECONDLY'));
    // One time is in UTC, one in a zone the phone knows by name.
    expect(starts(calendar(...hostile, ...dinner, ...at7('Europe/Berlin')))).toEqual([
      '2026-10-17T17:00:00.000Z',
      '2026-10-17T17:00:00.000Z',
    ]);
  });

  it('lays out only so many zones in one file', () => {
    // Each of these takes two fifths of what a file is allowed, whatever year this is run in.
    const since = new Date().getFullYear() + 5 - 400;
    const names = ['Example/One', 'Example/Two', 'Example/Three', 'Example/Four'];
    const file = calendar(...names.flatMap((name) => [...eastern(name, since), ...at7(name)]));
    expect(starts(file)).toEqual(['2026-10-17T23:00:00.000Z', '2026-10-17T23:00:00.000Z', sevenHere, sevenHere]);
  });

  it('counts even a zone whose rules have not begun', () => {
    // Each costs a little to start. Without that, a file could hold any number of them.
    const later = new Date().getFullYear() + 20;
    const names = Array.from({ length: 100 }, (_, index) => `Example/Later-${index}`);
    const file = calendar(
      ...names.flatMap((name) => [
        ...vtimezone(
          name,
          part('STANDARD', '19700101T000000', '+0300', '+0300'),
          part('DAYLIGHT', `${later}0311T020000`, '+0300', '+0400', 'FREQ=YEARLY;BYMONTH=3;BYDAY=2SU'),
        ),
        ...at7(name),
      ]),
    );
    const moments = starts(file);
    // 2,000 between them at 25 for each one's rule: 80 are read in the file's zone, the rest here.
    expect(moments.filter((moment) => moment === '2026-10-17T16:00:00.000Z')).toHaveLength(80);
    expect(moments.slice(80).every((moment) => moment === sevenHere)).toBe(true);
  });

  it('does not lay a zone out to the far future for one event', () => {
    const file = calendar(
      ...eastern('Example/Eastern'),
      ...vevent('UID:far@example.com', 'DTSTART;TZID=Example/Eastern:99991017T190000', 'SUMMARY:Far off'),
      ...at7('Example/Eastern'),
    );
    expect(parseIcs(file).events.map((event) => event.startsAt)).toEqual([
      local(9999, 9, 17, 19),
      utc('2026-10-17T23:00:00Z'),
    ]);
  });

  it('reads the time on this phone when the definition is empty or oddly made', () => {
    const file = calendar(
      ...vtimezone('Example/Empty'),
      ...at7('Example/Empty'),
      // ical.js would lay these parts out as well, whatever they are called.
      ...vtimezone('Example/Odd', part('X-OTHER', '19700101T000000', '+0100', '+0100', 'FREQ=SECONDLY')),
      ...at7('Example/Odd'),
      ...vtimezone('Example/No-Start', ['BEGIN:STANDARD', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0100', 'END:STANDARD']),
      ...at7('Example/No-Start'),
    );
    expect(starts(file)).toEqual([sevenHere, sevenHere, sevenHere]);
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

  it('never keeps an email address as the host', () => {
    const file = calendar(
      ...vevent(...dinner.slice(1, -1), 'ORGANIZER;CN=maya@example.com:mailto:maya@example.com'),
      ...vevent('UID:lunch@example.com', 'DTSTART:20261018T120000Z', 'ORGANIZER;CN="Okafor, Maya":mailto:maya@example.com'),
    );
    expect(parseIcs(file).events.map((event) => event.host)).toEqual(['', 'Okafor, Maya']);
  });
});

describe('repeating events', () => {
  it('leaves out a repeating event and its changed occurrence, and counts them', () => {
    expect(read('weekly')).toEqual({ events: [], skipped: 0, repeating: 2 });
  });

  it('counts every kind of repeat apart from what is skipped', () => {
    const file = calendar(
      ...vevent('UID:rule@example.com', 'DTSTART:20261005T180000Z', 'RRULE:FREQ=WEEKLY', 'SUMMARY:By rule'),
      ...vevent('UID:dates@example.com', 'DTSTART:20261005T180000Z', 'RDATE:20261012T180000Z', 'SUMMARY:By dates'),
      ...vevent('UID:one@example.com', 'RECURRENCE-ID:20261012T180000Z', 'DTSTART:20261013T180000Z', 'SUMMARY:One night'),
      // A rule that would never end its search is never looked at either.
      ...vevent('UID:never@example.com', 'DTSTART:20261001T090000Z', 'RRULE:FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30', 'SUMMARY:Never'),
      ...vevent('UID:off@example.com', 'DTSTART:20261005T180000Z', 'STATUS:CANCELLED', 'SUMMARY:Called off'),
      ...dinner,
    );
    const { events, skipped, repeating } = parseIcs(file);
    expect(events.map((event) => event.title)).toEqual(['Dinner']);
    expect([skipped, repeating]).toEqual([1, 4]);
  });

  it('does not go looking through a file of entries that share one UID', () => {
    // 4,000 repeating events and 4,000 changed occurrences, all claiming to be one event.
    const shared = Array.from({ length: 4000 }, (_, index) => [
      ...vevent('UID:shared@example.com', 'DTSTART:20261017T170000Z', 'RRULE:FREQ=WEEKLY;COUNT=2', `SUMMARY:Rule ${index}`),
      ...vevent('UID:shared@example.com', 'RECURRENCE-ID:20261017T170000Z', 'DTSTART:20261018T170000Z', `SUMMARY:Change ${index}`),
    ]).flat();
    const { events, skipped, repeating } = parseIcs(calendar(...shared, ...dinner));
    expect(events.map((event) => event.title)).toEqual(['Dinner']);
    expect([skipped, repeating]).toEqual([0, 8000]);
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
      ...vevent('UID:bad-end@example.com', 'DTSTART:20261017T170000Z', 'DTEND:garbage', 'SUMMARY:No such end'),
      ...dinner,
    );
    const { events, skipped } = parseIcs(file);
    expect(events.map((event) => event.title)).toEqual(['Dinner']);
    expect(skipped).toBe(3);
  });

  it('stops at 2,000 events and counts the rest', () => {
    const many = Array.from({ length: 2010 }, (_, index) =>
      vevent(`UID:many-${index}@example.com`, 'DTSTART:20261017T170000Z', `SUMMARY:Event ${index}`),
    ).flat();
    const { events, skipped } = parseIcs(calendar(...many));
    expect(events).toHaveLength(2000);
    expect(skipped).toBe(10);
  });
});

describe('files', () => {
  it('refuses a file that is not a calendar, in words a screen can show', () => {
    expect(() => read('not-a-calendar')).toThrow('This file is not a calendar.');
    expect(() => parseIcs('')).toThrow('This file is not a calendar.');
    expect(() => parseIcs(vevent('SUMMARY:No calendar around it').join('\r\n'))).toThrow(
      'This file is not a calendar.',
    );
  });

  it('refuses a calendar that is cut short or too big', () => {
    expect(() => parseIcs('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Cut off')).toThrow(
      'This calendar file is damaged and could not be read.',
    );
    expect(() => parseIcs(`BEGIN:VCALENDAR\r\n${'X'.repeat(2_000_000)}`)).toThrow('This file is too big to import.');
  });

  it('reads past an invisible mark and blank lines at the top, and more than one calendar', () => {
    const file = `\uFEFF\r\n\n${calendar(...dinner)}${calendar(...vevent('UID:lunch@example.com', 'DTSTART:20261018T120000Z', 'SUMMARY:Lunch'))}`;
    expect(parseIcs(file).events.map((event) => event.title)).toEqual(['Dinner', 'Lunch']);
  });

  it('gives an event with no UID a key made of its title and start', () => {
    const file = calendar(...vevent('DTSTART:20261017T170000Z', 'SUMMARY:Dinner'));
    expect(parseIcs(file).events[0].sourceId).toBe('Dinner|2026-10-17T17:00:00.000Z');
  });

  it('gives the same keys every time, so importing a file twice adds nothing', () => {
    const everything = () => [
      ...['timed', 'all-day', 'folded', 'no-vtimezone', 'weekly', 'partiful', 'cancelled'].flatMap(
        (name) => read(name).events,
      ),
      // No UID, and a day given the same date as its start and its end.
      ...parseIcs(
        calendar(
          ...vevent('DTSTART:20261017T170000Z', 'DTEND:20261017T190000Z', 'SUMMARY:Dinner'),
          ...vevent('UID:same-day@example.com', 'DTSTART;VALUE=DATE:20261031', 'DTEND;VALUE=DATE:20261031', 'SUMMARY:Fair'),
        ),
      ).events,
    ];
    const first = planImport([], everything(), { source: 'ics' });
    expect(first.result).toEqual({ added: 13, updated: 0, unchanged: 0, skipped: 0 });
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
      unchanged: 13,
      skipped: 0,
    });
  });
});
